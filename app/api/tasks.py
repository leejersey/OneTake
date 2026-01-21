"""
One Take API - 任务管理端点
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.models import TaskResult
from app.utils.task_manager import task_manager

router = APIRouter()


@router.get("/api/v1/tasks/{task_id}", response_model=TaskResult, tags=["任务管理"])
async def get_task_status(task_id: str):
    """
    查询任务状态
    
    - **task_id**: 任务 ID
    
    返回任务的当前状态、进度和结果（如果已完成）
    """
    try:
        return await task_manager.get_task(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/v1/tasks", tags=["任务管理"])
async def list_tasks(limit: int = 50, offset: int = 0):
    """
    获取任务列表
    
    - **limit**: 返回数量限制
    - **offset**: 偏移量（分页）
    
    返回任务列表
    """
    return await task_manager.list_tasks(limit=limit, offset=offset)


@router.get("/api/v1/tasks/{task_id}/edl", tags=["任务管理"])
async def get_task_edl(task_id: str):
    """
    获取任务的 EDL (Edit Decision List) 数据
    
    - **task_id**: 任务 ID
    
    返回完整的 EDL JSON 数据
    """
    try:
        return await task_manager.get_edl(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/v1/tasks/{task_id}/audio", tags=["任务管理"])
async def get_task_audio(task_id: str):
    """
    获取任务的原始音频文件
    
    - **task_id**: 任务 ID
    
    返回音频文件，用于波形图渲染
    """
    try:
        task_info = await task_manager.get_task_info(task_id)
        file_path = Path(task_info["file_path"])
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="音频文件不存在")
        
        # 确定 MIME 类型
        mime_types = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".mp4": "video/mp4",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
        }
        media_type = mime_types.get(file_path.suffix.lower(), "application/octet-stream")
        
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=file_path.name
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
