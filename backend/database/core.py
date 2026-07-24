from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

from utils.logger import get_logger

logger = get_logger(__name__)

# Default to Postgres URL if DATABASE_URL isn't set
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ailoop")
logger.info("Initializing database async engine", extra={"url_prefix": DATABASE_URL.split("@")[-1]})

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    logger.debug("Opening async DB session")
    async with async_session_maker() as session:
        yield session
