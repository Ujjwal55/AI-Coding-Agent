"""Spend-budget helpers for runs."""

from __future__ import annotations

from typing import Any, Optional, Tuple


class BudgetExceededError(RuntimeError):
    """Raised when estimated LLM spend hits the user-configured USD cap."""


def get_spent_usd(state: Optional[dict]) -> float:
    if not state:
        return 0.0
    usage = state.get("llm_usage") or {}
    try:
        return float(usage.get("estimated_cost_usd") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def get_budget_usd(state: Optional[dict]) -> Optional[float]:
    if not state:
        return None
    raw = state.get("cost_budget_usd")
    if raw is None or raw == "":
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def check_budget(state: Optional[dict]) -> Tuple[bool, str]:
    """
    Returns (ok, message). ok=False when a positive budget is set and spend >= budget.
    """
    budget = get_budget_usd(state)
    if budget is None:
        return True, ""
    spent = get_spent_usd(state)
    if spent >= budget:
        return (
            False,
            f"Spend budget exceeded: ${spent:.4f} >= ${budget:.4f} USD. "
            "Raise the budget chip or clear it to continue with more LLM calls.",
        )
    return True, ""


def assert_budget_allows_llm(state: Optional[dict], *, node_type: str = "node") -> None:
    ok, message = check_budget(state)
    if not ok:
        raise BudgetExceededError(f"[{node_type}] {message}")


def merge_budget_flags(result: dict, state: dict) -> dict:
    """Attach budget_exceeded after a node updates llm_usage."""
    merged_usage = result.get("llm_usage") or state.get("llm_usage")
    probe = {**state, "llm_usage": merged_usage, "cost_budget_usd": state.get("cost_budget_usd")}
    ok, message = check_budget(probe)
    if not ok:
        result = {
            **result,
            "budget_exceeded": True,
            "guardrail_message": message,
            "feedback": message,
        }
    return result
