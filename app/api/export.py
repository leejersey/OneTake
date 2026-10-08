"""
One Take API - 导出管理端点
"""

import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from app.models import ExportRequest, ExportResponse, TaskStatus
from app.config import settings
from app.utils.task_manager import task_manager
from app.services.ffmpeg_service import FFmpegService
from app.services.subtitle_service import SubtitleService
from app.utils.logger import get_logger

logger = get_logger("export")

router = APIRouter()

# 导出任务状态
export_tasks = {}


async def process_export_task(export_id: str, task_id: str, request: ExportRequest):
    """后台处理导出任务"""
    try:
        # 更新状态
        export_tasks[export_id]['status'] = TaskStatus.PROCESSING
        export_tasks[export_id]['progress'] = 10
        
        # 获取 EDL
        if request.edl:
            edl = request.edl
        else:
            edl = await task_manager.get_edl(task_id)
        
        export_tasks[export_id]['progress'] = 20
        
        # 获取原始视频文件路径
        task_info = await task_manager.get_task_info(task_id)
        input_video = task_info['file_path']
        
        # 检查是否是视频文件
        video_exts = {'.mp4', '.avi', '.mov'}
        if Path(input_video).suffix.lower() not in video_exts:
            raise ValueError("原始文件不是视频，无法剪辑")
        
        export_tasks[export_id]['progress'] = 30
        
        # 生成输出文件路径
        output_filename = f"{export_id}.{request.format.value}"
        output_path = settings.storage_path / "exports" / output_filename
        
        # 执行剪辑
        ffmpeg_service = FFmpegService(ffmpeg_path=settings.ffmpeg_path)
        clipped_path = ffmpeg_service.clip_video(
            input_video=input_video,
            edl=edl,
            output_path=output_path,
            quality=request.quality.value
        )
        
        export_tasks[export_id]['progress'] = 60
        
        result_path = clipped_path
        
        # 如果启用字幕，生成并烧录
        if request.subtitle and request.subtitle.enabled:
            logger.info(f"导出 {export_id}: 生成字幕")
            
            # 检测视频参数并生成 SRT
            subtitle_params = SubtitleService.get_optimal_subtitle_params(input_video)
            
            # 生成 SRT 文件
            srt_path = settings.storage_path / "exports" / f"{export_id}.srt"
            max_chars = subtitle_params['max_chars_per_line']
            
            SubtitleService.generate_srt(
                words=SubtitleService.remap_words(
                    edl.get('words', []), ffmpeg_service.extract_keep_segments(edl)
                ),
                output_path=str(srt_path),
                max_chars_per_line=max_chars
            )
            
            export_tasks[export_id]['progress'] = 70
            
            # 准备字幕配置
            subtitle_config = {
                'font_name': request.subtitle.font_name,
                'font_size': request.subtitle.font_size or subtitle_params['font_size'],
                'color': request.subtitle.color,
                'outline_color': request.subtitle.outline_color,
                'outline_width': request.subtitle.outline_width,
                'position': request.subtitle.position,
                'margin_v': subtitle_params['margin_v']
            }
            
            # 烧录字幕
            final_output = settings.storage_path / "exports" / f"{export_id}_final.{request.format.value}"
            result_path = ffmpeg_service.burn_subtitles(
                input_video=clipped_path,
                subtitle_file=str(srt_path),
                output_path=final_output,
                subtitle_config=subtitle_config
            )
            
            # 清理临时文件
            try:
                Path(clipped_path).unlink()
                Path(srt_path).unlink()
            except Exception:
                pass
        
        export_tasks[export_id]['progress'] = 100
        
        # 保存结果
        export_tasks[export_id]['status'] = TaskStatus.COMPLETED
        export_tasks[export_id]['output_file'] = result_path
        export_tasks[export_id]['updated_at'] = datetime.now()
        
    except Exception as e:
        logger.error(f"导出任务 {export_id} 失败: {str(e)}")
        export_tasks[export_id]['status'] = TaskStatus.FAILED
        export_tasks[export_id]['error'] = str(e)
        export_tasks[export_id]['updated_at'] = datetime.now()


@router.post("/api/v1/tasks/{task_id}/export", response_model=ExportResponse, tags=["视频导出"])
async def export_video(
    task_id: str,
    request: ExportRequest,
    background_tasks: BackgroundTasks
):
    """
    导出剪辑后的视频
    
    - **task_id**: 任务 ID
    - **request**: 导出请求（可选自定义 EDL）
    
    返回导出任务 ID
    """
    # 验证任务存在
    try:
        task = await task_manager.get_task(task_id)
        if task.status != TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=400,
                detail=f"任务未完成，当前状态: {task.status}"
            )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # 创建导出任务
    export_id = str(uuid.uuid4())
    export_tasks[export_id] = {
        'export_id': export_id,
        'task_id': task_id,
        'status': TaskStatus.PENDING,
        'progress': 0,
        'created_at': datetime.now(),
        'updated_at': datetime.now(),
        'output_file': None,
        'error': None
    }
    
    # 添加后台任务
    background_tasks.add_task(process_export_task, export_id, task_id, request)
    
    return ExportResponse(
        export_id=export_id,
        status=TaskStatus.PENDING,
        estimated_time=30,
        message="视频正在导出中，请稍候"
    )


@router.get("/api/v1/exports/{export_id}", tags=["视频导出"])
async def get_export_status(export_id: str):
    """
    查询导出任务状态
    
    - **export_id**: 导出任务 ID
    """
    if export_id not in export_tasks:
        raise HTTPException(status_code=404, detail=f"导出任务 {export_id} 不存在")
    
    task = export_tasks[export_id]
    
    result = {
        'export_id': task['export_id'],
        'status': task['status'],
        'progress': task['progress'],
        'created_at': task['created_at'],
        'updated_at': task['updated_at']
    }
    
    if task['status'] == TaskStatus.COMPLETED:
        result['download_url'] = f"/api/v1/exports/{export_id}/download"
    
    if task['error']:
        result['error'] = task['error']
    
    return result


@router.get("/api/v1/exports/{export_id}/download", tags=["视频导出"])
async def download_export(export_id: str):
    """
    下载导出的视频
    
    - **export_id**: 导出任务 ID
    """
    if export_id not in export_tasks:
        raise HTTPException(status_code=404, detail=f"导出任务 {export_id} 不存在")
    
    task = export_tasks[export_id]
    
    if task['status'] != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"视频尚未导出完成，当前状态: {task['status']}"
        )
    
    output_file = task['output_file']
    if not output_file or not Path(output_file).exists():
        raise HTTPException(status_code=404, detail="导出文件不存在")
    
    filename = Path(output_file).name
    
    return FileResponse(
        path=output_file,
        media_type='video/mp4',
        filename=f"onetake_export_{filename}"
    )
