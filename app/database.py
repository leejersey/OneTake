"""
One Take API - 数据库连接管理
"""

from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings
from app.utils.logger import get_logger

logger = get_logger("database")


class Base(DeclarativeBase):
    """SQLAlchemy ORM 基类"""
    pass


# 创建异步引擎
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

# 创建会话工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@asynccontextmanager
async def get_session():
    """获取数据库会话（异步上下文管理器）"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """初始化数据库（创建表）"""
    from app.db_models import Task, TaskResult  # 避免循环导入
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表已初始化")


async def close_db():
    """关闭数据库连接"""
    await engine.dispose()
    logger.info("数据库连接已关闭")


async def test_connection():
    """测试数据库连接"""
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        logger.info("数据库连接测试成功")
        return True
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        return False
