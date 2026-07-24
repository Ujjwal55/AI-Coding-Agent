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

    if ENABLE_LOCAL_LLM_FALLBACK:
        runnables.append(RunnableLambda(invoke_local_fallback))
        logger.info("Local Qwen fallback enabled via ENABLE_LOCAL_LLM_FALLBACK")

    if not runnables:
        raise RuntimeError(
            "No LLM backends available. Set GOOGLE_API_KEY and/or GROQ_API_KEY in backend/.env"
        )

    primary = runnables[0]
    if len(runnables) == 1:
        return primary

    # LangChain tries the next runnable when the previous raises.
    return primary.with_fallbacks(runnables[1:])
