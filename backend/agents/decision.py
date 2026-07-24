from typing import Dict, Any
from orchestrator.state import GraphState
from utils.logger import get_logger

logger = get_logger(__name__)

async def decision_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through node representing the Decision step in the graph."""
    logger.debug("Executing decision_node pass-through")
    return {}

def should_human_approve(state: GraphState) -> str:
    """Decision Node logic. Evaluates validation output to determine next route."""
    config = state.get("_current_node_config", {})
    max_retries = int(config.get("maxRetries", 3))
    status = state.get("validation_status", "UNKNOWN")
    attempt = state.get("current_attempt", 0)
    score = state.get("confidence_score", 1.0)
    
    logger.info("Evaluating decision node routing", extra={"validation_status": status, "attempt": attempt, "max_retries": max_retries, "confidence_score": score})
    
    if status == "FAIL":
        if attempt >= max_retries:
            logger.info("Decision route -> 'end' (Max retries reached)", extra={"attempt": attempt})
            return "end"
        logger.info("Decision route -> 'planner' (Retrying execution)", extra={"attempt": attempt})
        return "planner"
    
    if score < 0.8:
        logger.info("Decision route -> 'human_approval' (Low confidence score)", extra={"confidence_score": score})
        return "human_approval"
    
    logger.info("Decision route -> 'end' (Execution succeeded)")
    return "end"
