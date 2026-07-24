from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database.core import get_db
from models.workflow import Workflow, WorkflowVersion, WorkflowRun
from schemas.workflow import WorkflowCreate, WorkflowRead, WorkflowVersionCreate, WorkflowVersionRead, WorkflowRunRead
import uuid

from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/", response_model=WorkflowRead)
async def create_workflow(workflow: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    logger.info("Creating new workflow", extra={"workflow_name": workflow.name})
    db_workflow = Workflow(name=workflow.name, description=workflow.description)
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    logger.info("Workflow created successfully", extra={"workflow_id": db_workflow.id})
    return db_workflow

@router.get("/", response_model=list[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    logger.debug("Listing all workflows")
    result = await db.execute(select(Workflow))
    workflows = result.scalars().all()
    logger.info("Retrieved workflows", extra={"count": len(workflows)})
    return workflows

@router.post("/{workflow_id}/versions", response_model=WorkflowVersionRead)
async def save_workflow_version(workflow_id: str, version_in: WorkflowVersionCreate, db: AsyncSession = Depends(get_db)):
    logger.info("Saving workflow version", extra={"workflow_id": workflow_id})
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    if not wf_result.scalar_one_or_none():
        logger.error("Workflow not found when saving version", extra={"workflow_id": workflow_id})
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.workflow_id == workflow_id).order_by(WorkflowVersion.version.desc()))
    latest = result.scalars().first()
    next_version = (latest.version + 1) if latest else 1

    db_version = WorkflowVersion(
        workflow_id=workflow_id,
        version=next_version,
        graph_json=version_in.graph_json
    )
    db.add(db_version)
    await db.commit()
    await db.refresh(db_version)
    logger.info("Workflow version saved", extra={"workflow_id": workflow_id, "version": db_version.version, "version_id": db_version.id})
    return db_version

from pydantic import BaseModel
from typing import Optional, Dict, Any
from orchestrator.runtime import execute_workflow, memory_saver
from orchestrator.graph import build_dynamic_graph

class ResumeRequest(BaseModel):
    state_updates: Optional[Dict[str, Any]] = None

@router.post("/{version_id}/run", response_model=WorkflowRunRead)
async def run_workflow(version_id: str, db: AsyncSession = Depends(get_db)):
    logger.info("Initiating workflow run", extra={"version_id": version_id})
    v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == version_id))
    version = v_result.scalar_one_or_none()
    if not version:
        logger.error("Workflow version not found for run", extra={"version_id": version_id})
        raise HTTPException(status_code=404, detail="Version not found")

    run = WorkflowRun(version_id=version_id, status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    logger.info("Created workflow run record", extra={"run_id": str(run.id), "status": run.status})
    run = await execute_workflow(version_id, db, str(run.id))
    logger.info("Workflow execution finished", extra={"run_id": str(run.id), "status": run.status})
    return run

@router.post("/{run_id}/resume", response_model=WorkflowRunRead)
async def resume_workflow(run_id: str, request: ResumeRequest, db: AsyncSession = Depends(get_db)):
    logger.info("Resuming workflow run", extra={"run_id": run_id})
    r_result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = r_result.scalar_one_or_none()
    if not run:
        logger.error("Run not found for resume", extra={"run_id": run_id})
        raise HTTPException(status_code=404, detail="Run not found")
        
    if run.status != "paused":
        logger.error("Attempted to resume unpaused run", extra={"run_id": run_id, "current_status": run.status})
        raise HTTPException(status_code=400, detail="Run is not paused")
        
    run.status = "running"
    await db.commit()
    
    if request.state_updates:
        logger.debug("Applying state updates during resume", extra={"run_id": run_id, "updates": request.state_updates})
        v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == run.version_id))
        version = v_result.scalar_one_or_none()
        compiled_graph = build_dynamic_graph(version.graph_json)
        compiled_graph.checkpointer = memory_saver
        config = {"configurable": {"thread_id": run_id}}
        compiled_graph.update_state(config, request.state_updates)
    
    run = await execute_workflow(run.version_id, db, str(run.id))
    logger.info("Resumed workflow execution completed", extra={"run_id": str(run.id), "status": run.status})
    return run

from fastapi.responses import StreamingResponse
from utils.logger import subscribe_logs, unsubscribe_logs
import asyncio

@router.get("/logs/stream")
async def stream_logs():
    """Streams live backend JSON log events to frontend clients via Server-Sent Events (SSE)."""
    queue = await subscribe_logs()

    async def event_generator():
        try:
            while True:
                log_data = await queue.get()
                yield f"data: {log_data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await unsubscribe_logs(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
