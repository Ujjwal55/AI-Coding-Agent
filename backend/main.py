from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.workflow import router as workflow_router
from database.core import engine, Base
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup tables (for dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Teardown
    await engine.dispose()

app = FastAPI(title="AI Workflow Orchestration Platform", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For hackathon, open to all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflow_router, prefix="/api/workflows", tags=["workflows"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
