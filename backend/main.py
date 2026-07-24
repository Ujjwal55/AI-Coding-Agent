from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.workflow import router as workflow_router
from api.upload import router as upload_router
from database.core import engine, Base
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from alembic.config import Config
from alembic import command

from utils.logger import get_logger

logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up", extra={"action": "startup"})
    try:
        # Run Alembic DB migrations automatically on startup
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations completed successfully")
    except Exception as e:
        logger.critical("Alembic migration failed during startup", extra={"error": str(e)}, exc_info=True)
        raise e
    yield
    # Teardown
    logger.info("Application shutting down", extra={"action": "shutdown"})
    await engine.dispose()

app = FastAPI(title="AI Workflow Orchestration Platform", lifespan=lifespan)

import traceback
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("GLOBAL EXCEPTION CAUGHT:")
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": traceback.format_exc()})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon, open to all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflow_router, prefix="/api/workflows", tags=["workflows"])
app.include_router(upload_router, prefix="/api", tags=["upload"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/test-gemini")
async def test_gemini(model: str = "gemini-3.1-flash-lite"):
    from langchain_google_genai import ChatGoogleGenerativeAI
    try:
        llm = ChatGoogleGenerativeAI(model=model)
        response = await llm.ainvoke("Say 'test'")
        return {"status": "SUCCESS", "model": model, "response": response.content}
    except Exception as e:
        import traceback
        return {"status": "FAILURE", "model": model, "error": str(e), "traceback": traceback.format_exc()}

