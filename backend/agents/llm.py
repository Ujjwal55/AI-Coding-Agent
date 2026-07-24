"""LLM factory with multi-provider fallback chain.

Order (when keys exist):
  1. Requested / remapped primary model
  2. Other Gemini models (if Google key set)
  3. Current Groq models (if Groq key set)
  4. Optional local Qwen (off by default — too weak / often empty)

NOT a rate-limit detector: ANY primary failure (404, decommissioned model,
quota, auth) trips the next fallback. Check logs for the real exception.
"""

from __future__ import annotations

import os
from typing import List, Tuple

from langchain_core.runnables import RunnableLambda
from langchain_core.messages import BaseMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from utils.logger import get_logger

logger = get_logger(__name__)

_local_llm_instance = None

# Default model that is known to work with current Google GenAI API keys.
DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
# Groq: llama3-70b-8192 and mixtral-8x7b-32768 are decommissioned.
# Prefer current IDs (see https://console.groq.com/docs/deprecations).
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"
GROQ_FALLBACK_MODELS = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "llama-3.3-70b-versatile",  # still available until ~2026-08-16 for many tiers
    "llama-3.1-8b-instant",
]
GEMINI_FALLBACK_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-flash-latest",
]

# Local Qwen is optional; enabled by default for hackathon demos without cloud quota.
# Set ENABLE_LOCAL_LLM_FALLBACK=false to disable.
ENABLE_LOCAL_LLM_FALLBACK = os.getenv("ENABLE_LOCAL_LLM_FALLBACK", "true").lower() in (
    "1",
    "true",
    "yes",
)


def normalize_llm_content(content) -> str:
    """Normalize LangChain / Gemini content into a plain string."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content") or ""
                if text:
                    parts.append(str(text))
            else:
                text = getattr(block, "text", None)
                if text:
                    parts.append(str(text))
                else:
                    parts.append(str(block))
        return "\n".join(parts).strip()
    return str(content).strip()


def _remap_model_id(requested: str) -> str:
    name = (requested or "").strip().lower() or DEFAULT_GEMINI_MODEL

    legacy = {
        # Retired Gemini IDs
        "gemini-1.5-pro": DEFAULT_GEMINI_MODEL,
        "gemini-1.5-flash": DEFAULT_GEMINI_MODEL,
        "gemini-1.5-flash-latest": DEFAULT_GEMINI_MODEL,
        "gemini-pro": DEFAULT_GEMINI_MODEL,
        "gemini-2.5-pro": DEFAULT_GEMINI_MODEL,
        # Decommissioned Groq IDs
        "llama3-70b-8192": DEFAULT_GROQ_MODEL,
        "llama3-8b-8192": "llama-3.1-8b-instant",
        "mixtral-8x7b-32768": DEFAULT_GROQ_MODEL,
        "gemma2-9b-it": "llama-3.1-8b-instant",
    }
    if name in legacy:
        logger.info("Remapped retired model id", extra={"from": requested, "to": legacy[name]})
        return legacy[name]

    if any(token in name for token in ("gpt-4", "o1", "claude", "anthropic", "openai")) and not name.startswith(
        "openai/"
    ):
        # UI OpenAI/Anthropic labels → Gemini if available else Groq
        mapped = DEFAULT_GEMINI_MODEL if os.getenv("GOOGLE_API_KEY") else DEFAULT_GROQ_MODEL
        logger.info("Remapped unsupported UI model", extra={"from": requested, "to": mapped})
        return mapped

    return name


def _build_chat_model(model_id: str):
    mid = model_id.lower()
    if "gemini" in mid:
        if not os.getenv("GOOGLE_API_KEY"):
            raise RuntimeError("GOOGLE_API_KEY not set")
        return ChatGoogleGenerativeAI(model=model_id)
    # Groq (and groq-hosted openai/* / qwen/* ids)
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY not set")
    return ChatGroq(model=model_id)


def _candidate_chain(primary_id: str) -> List[Tuple[str, str]]:
    """Return ordered (model_id, provider) candidates without duplicates."""
    ordered: List[Tuple[str, str]] = []
    seen = set()

    def add(mid: str, provider: str):
        key = (mid, provider)
        if key in seen:
            return
        seen.add(key)
        ordered.append((mid, provider))

    primary = primary_id.lower()
    primary_provider = "gemini" if "gemini" in primary else "groq"
    add(primary_id, primary_provider)

    if os.getenv("GOOGLE_API_KEY"):
        for mid in GEMINI_FALLBACK_MODELS:
            add(mid, "gemini")

    if os.getenv("GROQ_API_KEY"):
        for mid in GROQ_FALLBACK_MODELS:
            add(mid, "groq")

    return ordered


def get_local_fallback_llm():
    """Optional tiny local model — disabled unless ENABLE_LOCAL_LLM_FALLBACK=true."""
    global _local_llm_instance
    if _local_llm_instance is not None:
        return _local_llm_instance

    from langchain_community.llms import LlamaCpp
    from huggingface_hub import hf_hub_download

    logger.warning(
        "Activating local Qwen 0.5B fallback (often low quality for coding)",
        extra={"hint": "Prefer fixing Gemini/Groq keys or model IDs"},
    )
    print("⚠️  LOCAL FALLBACK (Qwen 0.5B) — only used if ENABLE_LOCAL_LLM_FALLBACK=true")

    repo_id = "Qwen/Qwen1.5-0.5B-Chat-GGUF"
    filename = "qwen1_5-0_5b-chat-q4_k_m.gguf"
    cache_dir = os.path.join(os.path.dirname(__file__), "..", "models_cache")
    os.makedirs(cache_dir, exist_ok=True)
    model_path = hf_hub_download(repo_id=repo_id, filename=filename, cache_dir=cache_dir)

    _local_llm_instance = LlamaCpp(
        model_path=model_path,
        temperature=0.7,
        max_tokens=512,
        n_ctx=2048,
        verbose=False,
    )
    return _local_llm_instance


def invoke_local_fallback(prompt_or_messages):
    llm = get_local_fallback_llm()
    if isinstance(prompt_or_messages, list) and prompt_or_messages and isinstance(
        prompt_or_messages[0], BaseMessage
    ):
        prompt_str = "\n".join([f"{m.type}: {m.content}" for m in prompt_or_messages])
    else:
        prompt_str = str(prompt_or_messages)
    result = llm.invoke(prompt_str)
    return AIMessage(content=result)


MODEL_PRICING = {
    # Per 1M tokens: (input_usd, output_usd)
    "gemini-3.1-flash-lite": (0.075, 0.30),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-2.5-flash": (0.15, 0.60),
    "gemini-flash-latest": (0.10, 0.40),
    "llama-3.3-70b-versatile": (0.59, 0.79),
    "llama-3.1-8b-instant": (0.05, 0.08),
    "openai/gpt-oss-20b": (0.20, 0.50),
    "openai/gpt-oss-120b": (0.60, 1.20),
}
DEFAULT_PRICING = (0.15, 0.60)  # Default $0.15 / 1M input, $0.60 / 1M output


def extract_llm_metrics(response: Any, model_name: str = "default") -> dict:
    """
    Extract token usage (prompt, completion, total), model call count,
    and estimated cost in USD from a LangChain AIMessage response.
    """
    usage = getattr(response, "usage_metadata", None) or {}
    if not usage and hasattr(response, "response_metadata"):
        res_meta = getattr(response, "response_metadata", {}) or {}
        usage = res_meta.get("token_usage") or res_meta.get("usage") or {}

    # usage_metadata may be a dict or a LangChain object with attributes
    def _usage_get(key: str, default: int = 0) -> int:
        if isinstance(usage, dict):
            val = usage.get(key, default)
        else:
            val = getattr(usage, key, default)
        try:
            return int(val or 0)
        except (TypeError, ValueError):
            return default

    prompt_tokens = _usage_get("input_tokens") or _usage_get("prompt_tokens")
    completion_tokens = _usage_get("output_tokens") or _usage_get("completion_tokens")
    total_tokens = _usage_get("total_tokens") or (prompt_tokens + completion_tokens)
    cached_tokens = _usage_get("cache_read_input_tokens") or _usage_get("cached_tokens")

    # Calculate pricing
    model_key = model_name.lower()
    input_price, output_price = DEFAULT_PRICING
    for key, price_pair in MODEL_PRICING.items():
        if key in model_key:
            input_price, output_price = price_pair
            break

    cost_usd = ((prompt_tokens / 1_000_000) * input_price) + ((completion_tokens / 1_000_000) * output_price)

    return {
        "model": model_name,
        "calls": 1,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cached_tokens": cached_tokens,
        "estimated_cost_usd": round(cost_usd, 6),
    }


def aggregate_llm_usage(current_usage: dict | None, new_metrics: dict) -> dict:
    """
    Aggregate new LLM call metrics into existing GraphState cumulative tracking structure.
    """
    if not current_usage or not isinstance(current_usage, dict):
        current_usage = {
            "total_calls": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0.0,
            "breakdown_by_model": {},
        }

    model = new_metrics.get("model", "unknown")
    calls = new_metrics.get("calls", 1)
    prompt = new_metrics.get("prompt_tokens", 0)
    completion = new_metrics.get("completion_tokens", 0)
    total = new_metrics.get("total_tokens", 0)
    cost = new_metrics.get("estimated_cost_usd", 0.0)

    res = {
        "total_calls": current_usage.get("total_calls", 0) + calls,
        "prompt_tokens": current_usage.get("prompt_tokens", 0) + prompt,
        "completion_tokens": current_usage.get("completion_tokens", 0) + completion,
        "total_tokens": current_usage.get("total_tokens", 0) + total,
        "estimated_cost_usd": round(current_usage.get("estimated_cost_usd", 0.0) + cost, 6),
        "breakdown_by_model": dict(current_usage.get("breakdown_by_model", {})),
    }

    if model not in res["breakdown_by_model"]:
        res["breakdown_by_model"][model] = {
            "calls": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0.0,
        }

    m_data = dict(res["breakdown_by_model"][model])
    m_data["calls"] += calls
    m_data["prompt_tokens"] += prompt
    m_data["completion_tokens"] += completion
    m_data["total_tokens"] += total
    m_data["estimated_cost_usd"] = round(m_data["estimated_cost_usd"] + cost, 6)
    res["breakdown_by_model"][model] = m_data

    return res


def get_llm(model_name: str):
    """
    Build a chat model with a multi-provider fallback chain.

    Example: gemini-2.5-flash → gemini-2.0-flash → groq gpt-oss-20b → …
    """
    primary_id = _remap_model_id(model_name)
    candidates = _candidate_chain(primary_id)

    runnables = []
    for mid, provider in candidates:
        try:
            if provider == "gemini" and not os.getenv("GOOGLE_API_KEY"):
                continue
            if provider == "groq" and not os.getenv("GROQ_API_KEY"):
                continue
            runnables.append(_build_chat_model(mid))
            logger.info("LLM candidate registered", extra={"model": mid, "provider": provider})
        except Exception as e:
            logger.warning(
                "Skipping LLM candidate",
                extra={"model": mid, "provider": provider, "error": str(e)[:160]},
            )

    if not runnables:
        # Fallback to local if allowed or raise sensible error
        logger.warning("No API keys found for Google or Groq LLMs")
        return _build_chat_model(DEFAULT_GEMINI_MODEL)

    primary = runnables[0]
    if len(runnables) == 1:
        return primary

    # LangChain tries the next runnable when the previous raises.
    return primary.with_fallbacks(runnables[1:])

