from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowRead(WorkflowBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowVersionCreate(BaseModel):
    graph_json: Dict[str, Any]

class WorkflowVersionRead(BaseModel):
    id: str
    workflow_id: str
    version: int
    graph_json: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

class WorkflowRunRead(BaseModel):
    id: str
    version_id: str
    status: str
    state_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowEventRead(BaseModel):
    id: str
    run_id: str
    event_type: str
    node_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True
