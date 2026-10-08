"""
One Take API - 文件上传端点
"""

import uuid
import asyncio
import aiofiles
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Request
from app.models import UploadResponse, TaskStatus
from app.config import settings
from app.utils.task_manager import task_manager
from app.services.asr_service import ASRService
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger("upload")

# 支持的文件类型
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".avi", ".mov", ".flac", ".ogg"}


async def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """异步保存上传的文件"""
    async with aiofiles.open(destination, 'wb') as f:
        content = await upload_file.read()
        await f.write(content)


async def process_asr_task(task_id: str, file_path: str, language: str = None, model_size: str = None) -> None:
    """后台处理 ASR 任务"""
    from app.api.websocket import ws_manager
    
    async def update_progress(status: TaskStatus = None, progress: int = None, error: str = None):
        """更新进度并广播"""
        await task_manager.update_task(task_id, status=status, progress=progress, error=error)
        # WebSocket 广播
        msg = {"type": "progress", "progress": progress}
        if status:
            msg["status"] = status.value
        if error:
            msg["type"] = "error"
            msg["error"] = error
        await ws_manager.broadcast(task_id, msg)
    
    try:
        # 更新状态为处理中
        await update_progress(status=TaskStatus.PROCESSING, progress=10)
        logger.info(f"任务 {task_id} 开始处理")
        
        # 初始化 ASR 服务
        # 使用传入的 model_size，否则使用配置默认值
        actual_model = model_size or settings.whisper_model
        logger.info(f"加载 Whisper 模型: {actual_model}...")
        await update_progress(progress=20)
        
        asr_service = await asyncio.to_thread(
            ASRService, model_size=actual_model, device=settings.whisper_device
        )
        
        logger.info("模型加载完成，开始转写...")
        await update_progress(progress=30)
        
        # 处理音频（在线程池中运行同步操作）
        logger.info(f"正在转写音频文件: {file_path}")
        await update_progress(progress=40)
        
        result = await asyncio.to_thread(asr_service.process, file_path, language=language)
        
        logger.info(f"转写完成，共 {len(result.get('words', []))} 个词")
        await update_progress(progress=90)
        
        # 保存结果
        logger.info("保存结果...")
        await task_manager.update_task(
            task_id,
            status=TaskStatus.COMPLETED,
            progress=100,
            result=result
        )
        await ws_manager.broadcast(task_id, {
            "type": "completed",
            "progress": 100,
            "status": "completed"
        })
        
        logger.info(f"任务 {task_id} 处理完成！")
        
    except Exception as e:
        # 处理失败
        logger.error(f"任务 {task_id} 处理失败: {str(e)}")
        await update_progress(status=TaskStatus.FAILED, error=str(e))

from app.utils.rate_limit import limiter

@router.post("/api/v1/upload", response_model=UploadResponse, tags=["文件上传"])
@limiter.limit("10/minute")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="音频或视频文件"),
    language: str = Form(None, description="语言代码（如 zh, en）"),
    model_size: str = Form(None, description="模型大小（tiny, base, small, medium）")
):
    """
    上传音频或视频文件进行 ASR 转写
    
    **限流**: 10次/分钟
    
    - **file**: 音频/视频文件
    - **language**: 可选，语言代码
    - **model_size**: 可选，Whisper 模型大小
    
    返回任务 ID，可通过任务 ID 查询处理状态和结果
    """
    # 检查文件扩展名
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型 {file_ext}。支持的类型：{', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 检查文件大小
    content = await file.read()
    file_size = len(content)
    await file.seek(0)  # 重置文件指针
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="上传文件不能为空")

    if file_size > settings.max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大（{file_size / 1024 / 1024:.2f}MB），最大允许 {settings.max_file_size / 1024 / 1024}MB"
        )
    
    # 生成唯一文件名
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{file_ext}"
    file_path = settings.storage_path / "uploads" / safe_filename
    
    # 保存文件
    await save_upload_file(file, file_path)
    
    # 创建任务（异步）
    task_id = await task_manager.create_task(str(file_path), language=language)
    
    # 添加后台任务
    background_tasks.add_task(process_asr_task, task_id, str(file_path), language, model_size)
    
    return UploadResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        uploaded_at=datetime.now(),
        message=f"文件上传成功（{file_size / 1024 / 1024:.2f}MB），正在处理中"
    )
