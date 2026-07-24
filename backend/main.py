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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run Alembic DB migrations automatically on startup
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    yield
    # Teardown
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
