import os
from langchain_core.runnables import RunnableLambda
from langchain_core.messages import BaseMessage, AIMessage
from utils.logger import get_logger

logger = get_logger(__name__)

# Default model that is known to work with current Google GenAI API keys.
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def normalize_llm_content(content) -> str:
    """Normalize LangChain / Gemini content into a plain string.

    Gemini responses may be:
      - a plain string
      - a list of content blocks like [{'type':'text','text':'...'}]
    Downstream parsers (planner markdown, executor WRITE_FILE regex) need text.
    """
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


def get_local_fallback_llm():
    """
    Downloads (if necessary) and loads the tiny Qwen 0.5B model
    using llama-cpp-python for local execution.
    """
    global _local_llm_instance
    if _local_llm_instance is not None:
        return _local_llm_instance

    print("⚠️  PRIMARY LLM FAILED — activating local fallback (Qwen 0.5B) ⚠️")
    print("Note: this is NOT always a rate limit — check the exception above (often 404 model-not-found).")
    print("Downloading/Loading local fallback model if needed...")

    repo_id = "Qwen/Qwen1.5-0.5B-Chat-GGUF"
    filename = "qwen1_5-0_5b-chat-q4_k_m.gguf"

    # Define a local cache directory in the backend folder
    cache_dir = os.path.join(os.path.dirname(__file__), "..", "models_cache")
    os.makedirs(cache_dir, exist_ok=True)

    model_path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        cache_dir=cache_dir
    )

    _local_llm_instance = LlamaCpp(
        model_path=model_path,
        temperature=0.7,
        max_tokens=512,
        n_ctx=2048,
        verbose=False
    )

    return _local_llm_instance


def invoke_local_fallback(prompt_or_messages):
    llm = get_local_fallback_llm()
    # Convert LangChain messages to a simple string for LlamaCpp
    if isinstance(prompt_or_messages, list) and isinstance(prompt_or_messages[0], BaseMessage):
        prompt_str = "\n".join([f"{m.type}: {m.content}" for m in prompt_or_messages])
    else:
        prompt_str = str(prompt_or_messages)

    result = llm.invoke(prompt_str)

    # Return as an AIMessage to match the expected interface of ChatModels
    return AIMessage(content=result)


local_fallback_runnable = RunnableLambda(invoke_local_fallback)


def get_llm(model_name: str):
    """
    Factory function to return the correct LangChain LLM instance based on the model name,
    wrapped with a local fallback circuit breaker.

    Supported providers today: Google Gemini and Groq.
    UI labels like gpt-4o / claude / o1 are remapped to a real provider so a
    mismatched inspector selection does not silently fail into empty Qwen output.
    """
    requested = (model_name or "").strip()
    model_name = requested.lower() or DEFAULT_GEMINI_MODEL

    # Google retired gemini-1.5-* for many API keys (404 NOT_FOUND on v1beta).
    # Remap to currently available model IDs (Flash is the most reliable free tier).
    legacy_gemini = {
        "gemini-1.5-pro": DEFAULT_GEMINI_MODEL,
        "gemini-1.5-flash": DEFAULT_GEMINI_MODEL,
        "gemini-1.5-flash-latest": DEFAULT_GEMINI_MODEL,
        "gemini-pro": DEFAULT_GEMINI_MODEL,
        "gemini-2.5-pro": DEFAULT_GEMINI_MODEL,  # pro can 404 / quota on some keys
    }
    if model_name in legacy_gemini:
        print(f"ℹ️  Remapped Gemini model '{requested}' → '{legacy_gemini[model_name]}'")
        model_name = legacy_gemini[model_name]

    # Remap unsupported OpenAI/Anthropic labels to providers we actually wire.
    if any(token in model_name for token in ("gpt", "o1", "claude", "anthropic", "openai")):
        if os.getenv("GOOGLE_API_KEY"):
            model_name = DEFAULT_GEMINI_MODEL
        else:
            model_name = "llama3-70b-8192"
        print(f"ℹ️  Remapped unsupported model '{requested}' → '{model_name}'")

    if "gemini" in model_name:
        primary_llm = ChatGoogleGenerativeAI(model=model_name)
    else:
        groq_model = (
            model_name
            if ("llama" in model_name or "mixtral" in model_name or "gemma" in model_name)
            else "llama3-70b-8192"
        )
        primary_llm = ChatGroq(model_name=groq_model)

    # Wrap primary LLM with the local fallback circuit breaker
    return primary_llm.with_fallbacks([local_fallback_runnable])
