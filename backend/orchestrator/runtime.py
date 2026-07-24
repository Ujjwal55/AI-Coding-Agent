from orchestrator.graph import build_dynamic_graph
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.workflow import WorkflowVersion, WorkflowRun
from langgraph.checkpoint.memory import MemorySaver

# Global in-memory checkpointer for the hackathon MVP
memory_saver = MemorySaver()

async def execute_workflow(version_id: str, db: AsyncSession, run_id: str, initial_state: dict = None):
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
        
        # If resuming, we would use a checkpointer. For MVP without a checkpointer,
        # we start from the provided initial_state.
        state = initial_state or {
            "objective": "Build the feature",
            "current_attempt": 0,
            "success_criteria": [],
            "messages": []
        }
        
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
            run.state_json = snapshot.values
        else:
            run.status = "completed"
            run.state_json = final_state
        
    except Exception as e:
        run.status = "failed"
        run.state_json = {"error": str(e)}
        
    await db.commit()
    return run
