from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Default to a local sqlite file for quick dev if POSTGRES_URL isn't set.
# The user's spec asks for Postgres, so they should provide it via env in prod/docker.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./workflow.db")

engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    async with async_session_maker() as session:
        yield session
