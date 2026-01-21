"""
One Take API - FastAPI 应用主入口
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.api import health
from app.exceptions import OneTakeException
from app.utils.logger import logger

# 初始化限流器
limiter = Limiter(key_func=get_remote_address)

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="基于 AI 的视频自动剪辑 API",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 添加限流器到应用状态
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理器
@app.exception_handler(OneTakeException)
async def onetake_exception_handler(request: Request, exc: OneTakeException):
    """处理自定义异常"""
    logger.warning(f"业务异常: [{exc.code}] {exc.message}")
    return JSONResponse(
        status_code=400,
        content={
            "error": True,
            "code": exc.code,
            "message": exc.message
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理未捕获的异常"""
    logger.error(f"未处理异常: {type(exc).__name__}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误，请稍后重试"
        }
    )


# 注册路由
from app.api import upload, tasks, export as export_api, websocket as ws_api

app.include_router(health.router)
app.include_router(upload.router)
app.include_router(tasks.router)
app.include_router(export_api.router)
app.include_router(ws_api.router)


@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    from app.services.cleanup import cleanup_service
    from app.database import init_db
    
    logger.info(f"🚀 {settings.app_name} v{settings.version} 启动中...")
    logger.info(f"📁 存储路径: {settings.storage_path.absolute()}")
    logger.info(f"🎙️  Whisper 模型: {settings.whisper_model}")
    logger.info(f"📱 设备: {settings.whisper_device}")
    
    # 初始化数据库
    await init_db()
    logger.info("🗄️  数据库已连接")
    
    # 启动清理服务
    await cleanup_service.start()


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时执行"""
    from app.services.cleanup import cleanup_service
    from app.database import close_db
    
    await cleanup_service.stop()
    await close_db()
    logger.info(f"👋 {settings.app_name} 已关闭")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
