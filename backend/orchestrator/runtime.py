from orchestrator.graph import build_dynamic_graph
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from models.workflow import WorkflowVersion, WorkflowRun
from langgraph.checkpoint.memory import MemorySaver
from utils.logger import get_logger

logger = get_logger(__name__)

# Global in-memory checkpointer for the hackathon MVP
memory_saver = MemorySaver()

async def execute_workflow(version_id: str, db: AsyncSession, run_id: str, initial_state: dict = None):
    logger.info("Executing workflow runtime", extra={"version_id": version_id, "run_id": run_id})
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
        
    try:
        compiled_graph = build_dynamic_graph(version.graph_json)
        compiled_graph.checkpointer = memory_saver
        
        config = {"configurable": {"thread_id": run_id}}
        
        state = initial_state or {
            "objective": "Build the feature",
            "current_attempt": 0,
            "success_criteria": [],
            "messages": []
        }
        
        snapshot = compiled_graph.get_state(config)
        if snapshot.next:
            logger.info("Resuming execution from checkpoint", extra={"run_id": run_id, "next_nodes": snapshot.next})
            final_state = await compiled_graph.ainvoke(None, config)
        else:
            logger.info("Starting fresh graph execution", extra={"run_id": run_id})
            final_state = await compiled_graph.ainvoke(state, config)
            
        snapshot = compiled_graph.get_state(config)
        
        if snapshot.next:
            run.status = "paused"
            run.state_json = snapshot.values
            logger.info("Workflow paused at checkpoint gate", extra={"run_id": run_id, "paused_nodes": snapshot.next})
        else:
            run.status = "completed"
            run.state_json = final_state
            logger.info("Workflow execution completed successfully", extra={"run_id": run_id})
        
    except Exception as e:
        run.status = "failed"
        run.state_json = {"error": str(e)}
        logger.critical("Workflow execution failed with exception", extra={"run_id": run_id, "error": str(e)}, exc_info=True)
        
    await db.commit()
    await db.refresh(run)
    return run
