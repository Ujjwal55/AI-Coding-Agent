from typing import Dict, Any
from orchestrator.state import GraphState

async def criteria_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    
    # If the user already provided criteria manually via UI (Hybrid mode), use it
    if state.get("success_criteria") and len(state["success_criteria"]) > 0:
        return {"success_criteria": state["success_criteria"]}
        
    # Otherwise, generate mock criteria based on objective for Hackathon MVP
    # In a full implementation, this calls an LLM with config['instructions']
    objective = state.get("objective", "Unknown objective")
    
    generated_criteria = [
        f"Project builds successfully for '{objective}'",
        "Existing tests pass",
        "No protected files modified"
    ]
    
    return {"success_criteria": generated_criteria}
