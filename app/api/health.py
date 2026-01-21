"""
One Take API - 健康检查端点
"""

from datetime import datetime
from fastapi import APIRouter
from app.models import HealthResponse
from app.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["健康检查"])
async def health_check():
    """
    健康检查端点
    
    返回服务状态和版本信息
    """
    return HealthResponse(
        status="ok",
        version=settings.version,
        timestamp=datetime.now()
    )
