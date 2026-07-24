from typing import Dict, Any
import asyncio
import os
from orchestrator.state import GraphState
from agents.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage
from utils.logger import get_logger

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

    objective = state.get("objective", "Build feature requirement")
    model_name = config.get("model", "gemini-1.5-pro")
    instructions = config.get("instructions", "You are an expert engineer. Generate 3 concise success criteria for the objective.")

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

        logger.info("✅ [FINISH] Generated criteria via LLM", extra={"count": len(generated_criteria)})
        logger.debug("Generated criteria details", extra={"criteria": generated_criteria})

    except Exception as e:
        logger.warning("⚠️ LLM criteria generation failed, using fallback criteria", extra={"error": str(e)})
        generated_criteria = [
            f"Code compiles and builds cleanly for '{objective}'",
            f"API integration tests pass successfully",
            "No regression issues found"
        ]

    return {"success_criteria": generated_criteria}
