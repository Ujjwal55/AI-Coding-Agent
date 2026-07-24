from typing import Dict, Any
from orchestrator.state import GraphState

async def decision_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through node representing the Decision step in the graph."""
    return {}

def should_human_approve(state: GraphState) -> str:
    """Decision Node logic. Evaluates validation output to determine next route."""
    config = state.get("_current_node_config", {})
    max_retries = int(config.get("maxRetries", 3))
    
    if state["validation_status"] == "FAIL":
        if state.get("current_attempt", 0) >= max_retries:
            return "end" # Safe Stop
        return "planner" # Retry
    
    # Check if human approval is strictly required or confidence is low
    if state.get("confidence_score", 1.0) < 0.8:
        return "human_approval"
    
    return "end" # Success
