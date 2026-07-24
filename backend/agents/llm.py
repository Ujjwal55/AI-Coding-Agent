from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI as ChatGoogleGenAI
from utils.logger import get_logger

logger = get_logger(__name__)

def get_llm(model_name: str):
    """
    Factory function to return the correct LangChain LLM instance based on the model name.
    """
    model_name = model_name.lower()
    
    if "gemini" in model_name:
        logger.debug("Instantiating ChatGoogleGenerativeAI model", extra={"model_name": model_name})
        return ChatGoogleGenAI(model=model_name)
    else:
        fallback = model_name if ("llama" in model_name or "mixtral" in model_name or "gemma" in model_name) else "llama3-70b-8192"
        logger.debug("Instantiating ChatGroq model", extra={"model_name": fallback})
        return ChatGroq(model_name=fallback)
