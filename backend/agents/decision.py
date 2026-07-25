from typing import Dict, Any
from orchestrator.state import GraphState
from utils.logger import get_logger

logger = get_logger(__name__)

async def decision_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through that also tags validation-retry loops to skip plan review HITL."""
    logger.debug("Executing decision_node pass-through")
    if state.get("validation_status") == "FAIL":
        config = state.get("_current_node_config", {})
        max_retries = int(config.get("maxRetries", 3))
        if state.get("current_attempt", 0) < max_retries:
            # Human already approved a plan earlier; on validation retry, replan +
            # execute without asking them to approve the plan again.
            return {
                "skip_plan_review": True,
                "plan_feedback": state.get("feedback")
                or "Validation failed — revise the plan and implementation.",
            }
    return {}


async def plan_review_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through node representing the Plan Review gate.

    The graph interrupts *before* this node, so by the time it runs the human
    has already resumed with either an approval (plan_approved=True) or written
    feedback (plan_feedback set). Routing is handled by ``should_replan``.
    """
    return {}


def after_planner_route(state: GraphState) -> str:
    """After planning: skip HITL plan review on validation-driven retries.

    Planner consumes ``skip_plan_review`` and sets ``plan_approved=True`` for
    those retries, so we key off ``plan_approved`` here (post-node state).
    """
    if state.get("plan_approved"):
        return "executor"
    return "plan_review"


def after_objective_route(state: GraphState) -> str:
    """After Objective intent guard: continue coding loop or exit early."""
    if state.get("is_coding_task", True):
        return "continue"
    return "end"


def should_replan(state: GraphState) -> str:
    """Plan Review routing. Deterministically decide replan vs. execute.

    - Human approved the plan          -> "executor"
    - Feedback given & budget remains  -> "planner" (regenerate the plan)
    - Revision budget exhausted        -> "executor" (bounded: stop revising)
    """
    if state.get("plan_approved"):
        return "executor"

    config = state.get("_current_node_config", {})
    max_plan_revisions = int(
        config.get("maxPlanRevisions", state.get("max_plan_revisions", 3) or 3)
    )
    if state.get("plan_revision", 0) >= max_plan_revisions:
        return "executor"
    return "planner"


def should_human_approve(state: GraphState) -> str:
    """Decision Node logic. Evaluates validation output to determine next route.

    - Validation FAIL & retries remain -> "planner" (retry the loop)
    - Validation FAIL & budget spent    -> "end" (safe stop)
    - Validation PASS                    -> "human_approval" (code review gate)
    """
    config = state.get("_current_node_config", {})
    max_retries = int(config.get("maxRetries", 3))

    if state.get("validation_status") == "FAIL":
        if state.get("current_attempt", 0) >= max_retries:
            return "end"  # Safe Stop
        return "planner"  # Retry

    # Validation passed -> always route through the human code-review gate.
    return "human_approval"


def should_finish_after_review(state: GraphState) -> str:
    """Human Gate (code review) routing.

    - Human approved the code changes -> "end"
    - Human requested changes         -> "planner" (loop back with feedback)
    """
    if state.get("human_approved"):
        return "end"
    return "planner"
