from orchestrator.graph import build_dynamic_graph
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.workflow import WorkflowVersion, WorkflowRun
from langgraph.checkpoint.memory import MemorySaver
import logging

logger = logging.getLogger(__name__)

# Global in-memory checkpointer for the hackathon MVP
memory_saver = MemorySaver()

async def execute_workflow(
    version_id: str,
    db: AsyncSession,
    run_id: str,
    initial_state: dict = None,
    workspace_id: str = None,
):
    v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == version_id))
    version = v_result.scalar_one_or_none()
    if not version:
        raise ValueError("Version not found")

    r_result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = r_result.scalar_one_or_none()
    if not run:
        raise ValueError("Run not found")
        
    try:
        compiled_graph = build_dynamic_graph(version.graph_json)
        # Hacky way to inject checkpointer after compile if build_dynamic_graph didn't do it
        compiled_graph.checkpointer = memory_saver
        
        config = {"configurable": {"thread_id": run_id}}
        
        # Build default initial state
        state = initial_state or {
            "objective": "Build the feature",
            "current_attempt": 0,
            "success_criteria": [],
            "messages": [],
            "workspace_id": workspace_id,
            "plan_approved": False,
            "plan_revision": 0,
            "pause_reason": None,
        }

        # If workspace_id is provided and not already in state, inject it
        if workspace_id and not state.get("workspace_id"):
            state["workspace_id"] = workspace_id
        
        # Determine if we are resuming or starting fresh
        snapshot = compiled_graph.get_state(config)
        if snapshot.next:
            # We are resuming, don't pass initial state
            final_state = await compiled_graph.ainvoke(None, config)
        else:
            final_state = await compiled_graph.ainvoke(state, config)
            
        snapshot = compiled_graph.get_state(config)
        
        if snapshot.next:
            run.status = "paused"
            # Include pause_reason in the state for the frontend
            state_values = dict(snapshot.values) if snapshot.values else {}

            # Always derive the pause reason from the node we are about to run.
            # (Do not trust a possibly-stale pause_reason left in the state.)
            next_nodes = list(snapshot.next) if snapshot.next else []
            nodes_by_id = {n["id"]: n for n in version.graph_json.get("nodes", [])}
            pause_reason = None
            for next_node_id in next_nodes:
                node_type = nodes_by_id.get(next_node_id, {}).get("data", {}).get("nodeType", "")
                if node_type in ("plan_review", "executor"):
                    pause_reason = "plan_review"
                    break
                elif node_type == "human_gate":
                    pause_reason = "code_review"
                    break
                elif node_type in ("criteria", "planner"):
                    pause_reason = "criteria_review"
                    break

            state_values["pause_reason"] = pause_reason
            run.state_json = _make_serializable(state_values)
        else:
            run.status = "completed"
            run.state_json = _make_serializable(final_state)
        
    except Exception as e:
        logger.error(f"Workflow execution failed: {e}", exc_info=True)
        run.status = "failed"
        run.state_json = {"error": str(e)}
        
    await db.commit()
    await db.refresh(run)
    return run


def _make_serializable(state: dict) -> dict:
    """Convert state to JSON-serializable dict, handling LangChain message objects."""
    result = {}
    for key, value in state.items():
        if key.startswith("_"):
            continue  # Skip internal keys like _current_node_config
        try:
            # Test if it's JSON serializable
            import json
            json.dumps(value)
            result[key] = value
        except (TypeError, ValueError):
            # Convert non-serializable objects to string representation
            if isinstance(value, list):
                result[key] = [str(item) for item in value]
            else:
                result[key] = str(value)
    return result
