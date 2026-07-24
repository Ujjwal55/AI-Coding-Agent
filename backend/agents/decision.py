from typing import Dict, Any
from orchestrator.state import GraphState

async def decision_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through node representing the Decision step in the graph."""
    return {}


async def plan_review_node(state: GraphState) -> Dict[str, Any]:
    """Pass-through node representing the Plan Review gate.

    The graph interrupts *before* this node, so by the time it runs the human
    has already resumed with either an approval (plan_approved=True) or written
    feedback (plan_feedback set). Routing is handled by ``should_replan``.
    """
    return {}


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
