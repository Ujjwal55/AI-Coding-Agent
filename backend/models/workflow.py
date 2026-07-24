from sqlalchemy import Column, String, JSON, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.core import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class Workflow(Base):
    __tablename__ = "workflow"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    versions = relationship("WorkflowVersion", back_populates="workflow", cascade="all, delete-orphan")

class WorkflowVersion(Base):
    __tablename__ = "workflow_version"
    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("workflow.id"), nullable=False)
    version = Column(Integer, nullable=False)
    graph_json = Column(JSON, nullable=False)  # The React Flow JSON dump
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    workflow = relationship("Workflow", back_populates="versions")
    runs = relationship("WorkflowRun", back_populates="version")

class WorkflowRun(Base):
    __tablename__ = "workflow_run"
    id = Column(String, primary_key=True, default=generate_uuid)
    version_id = Column(String, ForeignKey("workflow_version.id"), nullable=False)
    status = Column(String, nullable=False, default="pending") # pending, running, paused, completed, failed
    state_json = Column(JSON, nullable=True) # The LangGraph state snapshot
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    version = relationship("WorkflowVersion", back_populates="runs")
    events = relationship("WorkflowEvent", back_populates="run", cascade="all, delete-orphan")

class WorkflowEvent(Base):
    __tablename__ = "workflow_event"
    id = Column(String, primary_key=True, default=generate_uuid)
    run_id = Column(String, ForeignKey("workflow_run.id"), nullable=False)
    event_type = Column(String, nullable=False) # node_started, node_completed, error, approval_requested
    node_id = Column(String, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    run = relationship("WorkflowRun", back_populates="events")
