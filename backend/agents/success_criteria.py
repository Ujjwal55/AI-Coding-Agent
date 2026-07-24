from typing import Dict, Any
from orchestrator.state import GraphState
from agents.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage
from utils.logger import get_logger

logger = get_logger(__name__)

async def criteria_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})
    
    # If the user already provided criteria manually via UI (Hybrid mode), use it
    if state.get("success_criteria") and len(state["success_criteria"]) > 0:
        logger.info("Using user-provided criteria (Hybrid mode)", extra={"count": len(state["success_criteria"])})
        logger.debug("Provided criteria", extra={"criteria": state["success_criteria"]})
        return {"success_criteria": state["success_criteria"]}
        
    objective = state.get("objective", "Unknown objective")
    model_name = config.get("model", "gemini-1.5-pro")
    instructions = config.get("instructions", "You are an expert engineer. Generate 3 concise success criteria for the objective. Output them as a simple list.")
    
    logger.info("Generating success criteria via LLM", extra={"objective": objective, "model": model_name})
    llm = get_llm(model_name)
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content=instructions),
            HumanMessage(content=f"Objective: {objective}")
        ])
        
        raw_text = getattr(response, "content", str(response))
        generated_criteria = [c.strip("- *1234567890.") for c in raw_text.split("\n") if c.strip()]
        
        if not generated_criteria:
            raise ValueError("No criteria generated")
            
        logger.info("Successfully generated criteria via LLM", extra={"count": len(generated_criteria)})
        logger.debug("Generated criteria list", extra={"criteria": generated_criteria})
            
    except Exception as e:
        logger.warning("LLM criteria generation failed, using fallback criteria", extra={"error": str(e)})
        generated_criteria = [
            f"Project builds successfully for '{objective}'",
            f"Mocked because API failed: {str(e)[:30]}",
            "No protected files modified"
        ]
    
    return {"success_criteria": generated_criteria}
