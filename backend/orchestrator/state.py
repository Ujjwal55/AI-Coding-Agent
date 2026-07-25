from typing import TypedDict, Annotated, List, Dict, Any, Optional
import operator

def merge_messages(old_messages: List[Dict[str, Any]], new_messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return old_messages + new_messages

class GraphState(TypedDict):
    # Core Context
    objective: str
    repo_path: Optional[str]
    success_criteria: List[str]
    
    # Workspace (uploaded repo)
    workspace_id: Optional[str]
    code_summary: Optional[str]
    
    # Execution Tracking
    plan: Optional[str]
    current_attempt: int
    max_attempts: int
    
    # Plan Review (Human Feedback Loop)
    plan_feedback: Optional[str]
    plan_approved: bool
    plan_revision: int          # how many times the plan has been (re)generated
    max_plan_revisions: int     # bound on the plan feedback loop
    # When True, planner → executor without pausing at plan_review
    # (used after validation failure retries — human already approved a plan once).
    skip_plan_review: bool
    
    # Execution State
    executor_output: Optional[str]
    artifacts: List[Dict[str, Any]]
    code_changes_summary: Optional[str]
    
    # Validation
    validation_status: str # "PASS" or "FAIL"
    confidence_score: float
    feedback: Optional[str]
    
    # Message History (LangGraph standard)
    messages: Annotated[List[Dict[str, Any]], merge_messages]
    
    # HITL (Human In The Loop)
    human_approved: bool
    
    # Pause reason for the frontend to know which panel to show
    pause_reason: Optional[str]  # "criteria_review", "plan_review", "code_review"

    # Intent guardrail (Objective node): coding task vs conversation / gibberish
    is_coding_task: bool
    intent_kind: Optional[str]  # "coding_task" | "conversation" | "unclear"
    guardrail_message: Optional[str]

    # BYOK — user-supplied key for this run (redacted when persisted to state_json)
    byok_provider: Optional[str]  # "gemini" | "groq" | "openai" | "openai_compatible" | "anthropic"
    byok_api_key: Optional[str]
    byok_model: Optional[str]
    byok_base_url: Optional[str]

    # Dynamic UI Configuration injected by graph compiler
    _current_node_config: Optional[Dict[str, Any]]

    # Token, Model Call, and Cost Tracking Metrics
    llm_usage: Optional[Dict[str, Any]]


