from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.llms import LlamaCpp
from huggingface_hub import hf_hub_download
from langchain_core.runnables import RunnableLambda
from langchain_core.messages import BaseMessage, AIMessage
import os

_local_llm_instance = None

def get_local_fallback_llm():
    """
    Downloads (if necessary) and loads the tiny Qwen 0.5B model 
    using llama-cpp-python for local execution.
    """
    global _local_llm_instance
    if _local_llm_instance is not None:
        return _local_llm_instance

    print("⚠️  API RATE LIMIT OR ERROR DETECTED! ⚠️")
    print("Circuit Breaker Tripped! Downloading/Loading local fallback model (Qwen 0.5B)...")
    
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
    """
    model_name = model_name.lower()
    
    if "gemini" in model_name:
        primary_llm = ChatGoogleGenerativeAI(model=model_name)
    else:
        # Default/Fallback to Groq (free tier)
        fallback = model_name if ("llama" in model_name or "mixtral" in model_name or "gemma" in model_name) else "llama3-70b-8192"
        primary_llm = ChatGroq(model_name=fallback)
        
    # Wrap primary LLM with the local fallback circuit breaker
    return primary_llm.with_fallbacks([local_fallback_runnable])

