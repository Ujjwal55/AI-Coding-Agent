from typing import Dict, Any
import asyncio
import os
# pyrefly: ignore [missing-import]
from orchestrator.state import GraphState
from agents.llm import get_llm, normalize_llm_content, extract_llm_metrics, aggregate_llm_usage
from langchain_core.messages import SystemMessage, HumanMessage
from utils.logger import get_logger
from utils.metadata_tracker import record_llm_metrics

logger = get_logger(__name__)

STEP_DELAY_SECONDS = float(os.getenv("STEP_DELAY_SECONDS", "10"))


async def criteria_node(state: GraphState) -> Dict[str, Any]:
    config = state.get("_current_node_config", {})

    logger.info("⚡ [START] Criteria Node processing...", extra={"node": "criteria", "delay_sec": STEP_DELAY_SECONDS})

    # Simulated 10-second processing delay
    logger.info(f"⏳ Criteria Node analyzing objective... (waiting {STEP_DELAY_SECONDS} seconds)", extra={"status": "IN_PROGRESS"})
    await asyncio.sleep(STEP_DELAY_SECONDS)

    # If the user already provided criteria manually via UI (Hybrid mode), use it
    if state.get("success_criteria") and len(state["success_criteria"]) > 0:
        logger.info("✅ [FINISH] Using user-provided criteria (Hybrid mode)", extra={"count": len(state["success_criteria"])})
        logger.debug("Provided criteria list", extra={"criteria": state["success_criteria"]})
        return {"success_criteria": state["success_criteria"]}
        
    objective = state.get("objective", "Unknown objective")
    model_name = config.get("model", "gemini-3.1-flash-lite")
    instructions = config.get("instructions", "You are an expert engineer. Generate 3 concise success criteria for the objective. Output them as a simple list.")
    
    llm = get_llm(model_name)
    usage_updates = {}

    try:
        response = await llm.ainvoke([
            SystemMessage(content=instructions),
            HumanMessage(content=f"Objective: {objective}")
        ])
        
        content = normalize_llm_content(response.content)
        # Split by newlines and clean up
        generated_criteria = [c.strip("- *1234567890.") for c in content.split("\n") if c.strip()]
        
        metrics = extract_llm_metrics(response, model_name)
        record_llm_metrics("criteria", metrics)
        updated_usage = aggregate_llm_usage(state.get("llm_usage"), metrics)
        usage_updates = {"llm_usage": updated_usage}
        logger.info(
            f"📊 LLM Call Stats [Criteria] | Model: {model_name} | Tokens: {metrics['total_tokens']} "
            f"(In: {metrics['prompt_tokens']}, Out: {metrics['completion_tokens']}) | Cost: ${metrics['estimated_cost_usd']:.6f}"
        )

        if not generated_criteria:
            raise ValueError("No criteria generated")

        logger.info("✅ [FINISH] Generated criteria via LLM", extra={"count": len(generated_criteria)})
        logger.debug("Generated criteria details", extra={"criteria": generated_criteria})

    except Exception as e:
        logger.warning("⚠️ LLM criteria generation failed, using fallback criteria", extra={"error": str(e)})
        generated_criteria = [
            f"Code compiles and builds cleanly for '{objective}'",
            f"API integration tests pass successfully",
            "No regression issues found"
        ]

    return {"success_criteria": generated_criteria, **usage_updates}

