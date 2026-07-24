from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database.core import get_db
from models.workflow import Workflow, WorkflowVersion, WorkflowRun
from schemas.workflow import WorkflowCreate, WorkflowRead, WorkflowVersionCreate, WorkflowVersionRead, WorkflowRunRead
import uuid

router = APIRouter()

@router.post("/", response_model=WorkflowRead)
async def create_workflow(workflow: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    db_workflow = Workflow(name=workflow.name, description=workflow.description)
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    return db_workflow

@router.get("/", response_model=list[WorkflowRead])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow))
    return result.scalars().all()

@router.post("/{workflow_id}/versions", response_model=WorkflowVersionRead)
async def save_workflow_version(workflow_id: str, version_in: WorkflowVersionCreate, db: AsyncSession = Depends(get_db)):
    # Check if workflow exists
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    if not wf_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    # Get latest version number
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
    return db_version

from pydantic import BaseModel
from typing import Optional, Dict, Any
from orchestrator.runtime import execute_workflow, memory_saver
from orchestrator.graph import build_dynamic_graph

class ResumeRequest(BaseModel):
    state_updates: Optional[Dict[str, Any]] = None

@router.post("/{version_id}/run", response_model=WorkflowRunRead)
async def run_workflow(version_id: str, db: AsyncSession = Depends(get_db)):
    v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == version_id))
    version = v_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    run = WorkflowRun(version_id=version_id, status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)
    
    # Delegate to runtime manager
    run = await execute_workflow(version_id, db, str(run.id))
    
    return run

@router.post("/{run_id}/resume", response_model=WorkflowRunRead)
async def resume_workflow(run_id: str, request: ResumeRequest, db: AsyncSession = Depends(get_db)):
    r_result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    run = r_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    if run.status != "paused":
        raise HTTPException(status_code=400, detail="Run is not paused")
        
    run.status = "running"
    await db.commit()
    
    # We must update the state with whatever the user provided (e.g. edited criteria)
    if request.state_updates:
        v_result = await db.execute(select(WorkflowVersion).where(WorkflowVersion.id == run.version_id))
        version = v_result.scalar_one_or_none()
        compiled_graph = build_dynamic_graph(version.graph_json)
        compiled_graph.checkpointer = memory_saver
        config = {"configurable": {"thread_id": run_id}}
        compiled_graph.update_state(config, request.state_updates)
    
    run = await execute_workflow(run.version_id, db, str(run.id))
    
    return run
