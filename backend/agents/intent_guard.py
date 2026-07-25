"""Intent guardrail: is this a coding task or just conversation / gibberish?

Runs inside the Objective node so non-coding inputs exit before Criteria /
Planner / Executor (and before STEP_DELAY sleeps on those agents).
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from agents.llm import get_llm, normalize_llm_content
from orchestrator.state import GraphState
from utils.logger import get_logger

logger = get_logger(__name__)

# Clear conversational / non-task patterns (no LLM needed).
_GREETING_RE = re.compile(
    r"^\s*("
    r"hi+|h+e+y+|hello+|howdy|yo+|sup|"
    r"good\s*(morning|afternoon|evening|night)|"
    r"thanks?|thank\s*you|ty|thx|"
    r"bye+|goodbye|see\s*ya|ok+|okay|k+|sure|"
    r"lol+|lmao+|haha+|hehe+|"
    r"what'?s\s*up|how\s*are\s*you|who\s*are\s*you|"
    r"test|testing|asdf+|qwerty+|xxx+"
    r")[\s!.?]*$",
    re.IGNORECASE,
)

_CODING_HINTS = re.compile(
    r"\b("
    r"add|create|implement|build|write|fix|bug|feature|refactor|update|"
    r"delete|remove|rename|migrate|deploy|test|unit\s*test|api|endpoint|"
    r"function|method|class|module|file|folder|repo|code|python|javascript|"
    r"typescript|react|fastapi|sql|database|schema|auth|login|ui|page|"
    r"component|error|exception|crash|performance|optimize|docker|"
    r"endpoint|route|handler|script|cli|json|yaml|config"
    r")\b",
    re.IGNORECASE,
)

_CONVERSATION_REPLY = (
    "This control plane is for **coding objectives** (e.g. “Add an add(a, b) "
    "function in Python” or “Fix the login bug”), not chat.\n\n"
    "Your message looks like conversation or isn’t a clear engineering task. "
    "Please rephrase as a concrete change you want in the uploaded workspace."
)

_FEEDBACK_HINTS = re.compile(
    r"\b("
    r"add|remove|delete|change|update|fix|instead|also|don't|do\s*not|"
    r"should|need|needs|prefer|please|make|use|rename|move|split|merge|"
    r"simplify|refactor|include|exclude|missing|wrong|incorrect|broken|"
    r"bug|error|fail|failing|test|file|function|class|api|endpoint|"
    r"rate\s*limit|auth|login|ui|page|component|path|module|import|"
    r"more|less|longer|shorter|clearer|specific|detail|step"
    r")\b",
    re.IGNORECASE,
)

_FEEDBACK_REJECT = (
    "That doesn’t look like actionable review feedback.\n\n"
    "Describe a concrete change (e.g. “Also add input validation” or "
    "“Use add.py instead of hello_world.py”). Chat like “Hi” / “ok” / "
    "“lol” won’t replan — Approve if you’re happy with the current result."
)


def _heuristic(objective: str) -> Optional[Dict[str, Any]]:
    text = (objective or "").strip()
    if not text:
        return {
            "is_coding_task": False,
            "intent_kind": "unclear",
            "guardrail_message": (
                "Objective is empty. Enter a concrete coding task before Run."
            ),
        }

    if _GREETING_RE.match(text):
        return {
            "is_coding_task": False,
            "intent_kind": "conversation",
            "guardrail_message": _CONVERSATION_REPLY,
        }

    # Very short + no coding vocabulary → treat as non-task without an LLM round-trip.
    words = re.findall(r"[A-Za-z0-9_+.-]+", text)
    if len(words) <= 3 and not _CODING_HINTS.search(text):
        return {
            "is_coding_task": False,
            "intent_kind": "conversation",
            "guardrail_message": (
                f"“{text}” doesn’t look like a coding task.\n\n"
                + _CONVERSATION_REPLY
            ),
        }

    if _CODING_HINTS.search(text) and len(words) >= 3:
        return {
            "is_coding_task": True,
            "intent_kind": "coding_task",
            "guardrail_message": None,
        }

    return None  # ambiguous → optional LLM


async def _llm_classify(objective: str, model_name: str) -> Dict[str, Any]:
    llm = get_llm(model_name)
    prompt = (
        "Classify the user message for an AI coding control plane.\n"
        "Reply with EXACTLY one line in this format:\n"
        "LABEL|short reply to the user\n"
        "LABEL must be one of: CODING, CONVERSATION, UNCLEAR\n"
        "If CODING, the reply may be empty after the pipe.\n"
        "If CONVERSATION or UNCLEAR, give a brief helpful reply telling them "
        "to provide a concrete coding objective.\n\n"
        f"User message: {objective}"
    )
    try:
        response = await llm.ainvoke(
            [
                SystemMessage(
                    content="You are a strict intent classifier. Never invent code tasks."
                ),
                HumanMessage(content=prompt),
            ]
        )
        raw = normalize_llm_content(response.content).strip()
        line = raw.splitlines()[0] if raw else ""
        label, _, rest = line.partition("|")
        label = label.strip().upper()
        message = rest.strip() or _CONVERSATION_REPLY

        if label.startswith("CODING"):
            return {
                "is_coding_task": True,
                "intent_kind": "coding_task",
                "guardrail_message": None,
            }
        kind = "conversation" if label.startswith("CONVERSATION") else "unclear"
        return {
            "is_coding_task": False,
            "intent_kind": kind,
            "guardrail_message": message,
        }
    except Exception as e:
        logger.warning("Intent LLM classify failed; allowing coding path", extra={"error": str(e)})
        # Fail open so real tasks are not blocked by model outages.
        return {
            "is_coding_task": True,
            "intent_kind": "coding_task",
            "guardrail_message": None,
        }


async def classify_objective_intent(
    objective: str, model_name: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """Return is_coding_task / intent_kind / guardrail_message."""
    quick = _heuristic(objective)
    if quick is not None:
        logger.info(
            "Intent guardrail (heuristic)",
            extra={"intent_kind": quick["intent_kind"], "is_coding_task": quick["is_coding_task"]},
        )
        return quick

    result = await _llm_classify(objective, model_name)
    logger.info(
        "Intent guardrail (llm)",
        extra={"intent_kind": result["intent_kind"], "is_coding_task": result["is_coding_task"]},
    )
    return result


async def intent_guard_from_state(state: GraphState) -> Dict[str, Any]:
    objective = state.get("objective") or ""
    config = state.get("_current_node_config") or {}
    model_name = config.get("model") or "gemini-2.5-flash"
    return await classify_objective_intent(objective, model_name=model_name)


def classify_human_feedback(feedback: str, *, context: str = "plan") -> Dict[str, Any]:
    """Guardrail for plan / code-review feedback before resuming the loop.

    Returns ``is_actionable`` + optional ``guardrail_message``.
    Fast heuristics only (no LLM) so resume stays snappy.
    """
    text = (feedback or "").strip()
    label = "plan" if context == "plan" else "code"

    if not text:
        return {
            "is_actionable": False,
            "intent_kind": "unclear",
            "guardrail_message": (
                f"Feedback is empty. Write a concrete {label} change request, "
                "or use Approve instead."
            ),
        }

    if _GREETING_RE.match(text):
        return {
            "is_actionable": False,
            "intent_kind": "conversation",
            "guardrail_message": _FEEDBACK_REJECT,
        }

    words = re.findall(r"[A-Za-z0-9_+.-]+", text)
    if len(words) <= 2 and not _FEEDBACK_HINTS.search(text) and not _CODING_HINTS.search(text):
        return {
            "is_actionable": False,
            "intent_kind": "conversation",
            "guardrail_message": (
                f"“{text}” isn’t actionable {label} feedback.\n\n" + _FEEDBACK_REJECT
            ),
        }

    if len(words) <= 4 and not (
        _FEEDBACK_HINTS.search(text) or _CODING_HINTS.search(text)
    ):
        return {
            "is_actionable": False,
            "intent_kind": "unclear",
            "guardrail_message": (
                f"“{text}” is too vague to replan from.\n\n" + _FEEDBACK_REJECT
            ),
        }

    logger.info(
        "Feedback guardrail accepted",
        extra={"context": context, "word_count": len(words)},
    )
    return {
        "is_actionable": True,
        "intent_kind": "actionable_feedback",
        "guardrail_message": None,
    }
