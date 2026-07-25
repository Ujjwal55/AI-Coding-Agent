from orchestrator.graph import build_dynamic_graph
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.workflow import WorkflowVersion, WorkflowRun
from langgraph.checkpoint.memory import MemorySaver
from utils.logger import get_logger

logger = get_logger(__name__)

# Global in-memory checkpointer for the hackathon MVP
memory_saver = MemorySaver()

# Global flag to signal a pause at the next node execution
GLOBAL_PAUSE_REQUESTED = False


import asyncio

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
        logger.error("Workflow version not found", extra={"version_id": version_id})
        raise ValueError("Version not found")

    r_result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = r_result.scalar_one_or_none()
    if not run:
        logger.error("Workflow run not found", extra={"run_id": run_id})
        raise ValueError("Run not found")

    from agents.llm import apply_byok_from_state, clear_byok_credentials

    try:
        compiled_graph = build_dynamic_graph(version.graph_json)
        compiled_graph.checkpointer = memory_saver

        config = {"configurable": {"thread_id": run_id}}

        state = {
            "objective": "Build the feature",
            "repo_path": "target_repo",
            "current_attempt": 0,
            "success_criteria": [],
            "messages": [],
        }
        if initial_state:
            state.update({k: v for k, v in initial_state.items() if v is not None})
        if not state.get("repo_path"):
            state["repo_path"] = "target_repo"
        if not state.get("objective"):
            state["objective"] = "Build the feature"
        if workspace_id:
            state["workspace_id"] = workspace_id

        apply_byok_from_state(state)

        # Determine if we are resuming or starting fresh
        snapshot = compiled_graph.get_state(config)
        if snapshot.next:
            # Prefer BYOK from this resume's initial_state; else checkpoint values.
            if initial_state and initial_state.get("byok_api_key"):
                apply_byok_from_state(initial_state)
            elif snapshot.values:
                apply_byok_from_state(dict(snapshot.values))
            logger.info(
                "Resuming execution from checkpoint",
                extra={"run_id": run_id, "next_nodes": snapshot.next},
            )
            final_state = await compiled_graph.ainvoke(None, config)
        else:
            from utils.metadata_tracker import clear_metadata

            clear_metadata()
            logger.info("Starting fresh graph execution", extra={"run_id": run_id})
            final_state = await compiled_graph.ainvoke(state, config)

        snapshot = compiled_graph.get_state(config)

        if snapshot.next:
            run.status = "paused"
            state_values = dict(snapshot.values) if snapshot.values else {}

            # Always derive the pause reason from the node we are about to run.
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

    except asyncio.CancelledError:
        logger.info("Task cancelled mid-execution", extra={"run_id": run_id})
        run.status = "paused"
        snapshot = compiled_graph.get_state(config)
        state_values = dict(snapshot.values) if snapshot.values else {}
        state_values["pause_reason"] = "user_paused"
        run.state_json = _make_serializable(state_values)
        await db.commit()
        await db.refresh(run)
        return run

    except Exception as e:
        if type(e).__name__ == "NodeInterrupt" or "user_paused" in str(e):
            logger.info("Run interrupted by user_paused exception.", extra={"run_id": run_id})
            run.status = "paused"
            snapshot = compiled_graph.get_state(config)
            state_values = dict(snapshot.values) if snapshot.values else {}
            state_values["pause_reason"] = "user_paused"
            run.state_json = _make_serializable(state_values)
        else:
            from utils.budget import BudgetExceededError

            logger.error(f"Workflow execution failed: {e}", exc_info=True)
            run.status = "failed"
            snapshot = compiled_graph.get_state(config)
            state_values = dict(snapshot.values) if snapshot.values else {}
            state_values["error"] = str(e)
            if isinstance(e, BudgetExceededError) or "Spend budget exceeded" in str(e):
                state_values["budget_exceeded"] = True
                state_values["guardrail_message"] = str(e)
                state_values["feedback"] = str(e)
            run.state_json = _make_serializable(state_values)
            logger.critical(
                "Workflow execution failed with exception",
                extra={"run_id": run_id, "error": str(e)},
                exc_info=True,
            )
    finally:
        clear_byok_credentials()

    await db.commit()
    await db.refresh(run)
    return run


def _make_serializable(state: dict) -> dict:
    """Convert state to JSON-serializable dict, handling LangChain message objects."""
    result = {}
    for key, value in state.items():
        if key.startswith("_"):
            continue  # Skip internal keys like _current_node_config
        # Never persist raw BYOK secrets in WorkflowRun.state_json.
        if key == "byok_api_key" and isinstance(value, str) and value:
            result[key] = f"***{value[-4:]}" if len(value) >= 4 else "****"
            continue
        try:
            import json

            json.dumps(value)
            result[key] = value
        except (TypeError, ValueError):
            if isinstance(value, list):
                result[key] = [str(item) for item in value]
            else:
                result[key] = str(value)
    return result
