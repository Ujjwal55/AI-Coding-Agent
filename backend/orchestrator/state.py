from typing import TypedDict, Annotated, List, Dict, Any, Optional
import operator

def merge_messages(old_messages: List[Dict[str, Any]], new_messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return old_messages + new_messages

class GraphState(TypedDict):
    # Core Context
    objective: str
    success_criteria: List[str]
    
    # Execution Tracking
    plan: Optional[str]
    current_attempt: int
    max_attempts: int
    
    # Execution State
    executor_output: Optional[str]
    artifacts: List[Dict[str, Any]]
    
    # Validation
    validation_status: str # "PASS" or "FAIL"
    confidence_score: float
    feedback: Optional[str]
    
    # Message History (LangGraph standard)
    messages: Annotated[List[Dict[str, Any]], merge_messages]
    
    # HITL (Human In The Loop)
    human_approved: bool

    # Dynamic UI Configuration injected by graph compiler
    _current_node_config: Optional[Dict[str, Any]]
