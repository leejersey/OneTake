"""One Take API - persistent export jobs."""
import asyncio
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


def render_export(export_id: str, input_video: str, edl: dict, request: ExportRequest) -> str:
    """All blocking media operations run together in a worker thread."""
    output_path = settings.storage_path / 'exports' / f'{export_id}.{request.format.value}'
    service = FFmpegService(ffmpeg_path=settings.ffmpeg_path)
    clipped = service.clip_video(input_video, edl, output_path, request.quality.value)
    if not request.subtitle or not request.subtitle.enabled:
        return clipped
    width, height, *_ = SubtitleService.detect_aspect_ratio(clipped)
    srt = output_path.with_suffix('.ass')
    config = request.subtitle.model_dump()
    SubtitleService.generate_ass(edl.get('words', []), str(srt), service.extract_keep_segments(edl),
                                 config, width, height)
    final = output_path.with_name(f'{export_id}_final.{request.format.value}')
    result = service.burn_subtitles(clipped, str(srt), final, subtitle_config=config,
                                   quality=request.quality.value)
    for temporary in (Path(clipped), srt):
        try:
            temporary.unlink()
        except OSError as error:
            logger.warning(f'临时文件清理失败 {temporary}: {error}')
    return result


async def process_export_task(export_id: str, task_id: str, request: ExportRequest):
    try:
        await task_manager.update_export(export_id, status='processing', progress=10)
        edl = request.edl if request.edl is not None else await task_manager.get_edl(task_id)
        info = await task_manager.get_task_info(task_id)
        input_video = info['file_path']
        if Path(input_video).suffix.lower() not in {'.mp4', '.avi', '.mov'}:
            raise ValueError('原始文件不是视频，无法剪辑')
        await task_manager.update_export(export_id, progress=30)
        output = await asyncio.to_thread(render_export, export_id, input_video, edl, request)
        await task_manager.update_export(export_id, status='completed', progress=100, output_file=output)
    except Exception as error:
        logger.error(f'导出任务 {export_id} 失败: {error}')
        await task_manager.update_export(export_id, status='failed', error=str(error))


@router.post('/api/v1/tasks/{task_id}/export', response_model=ExportResponse, tags=['视频导出'])
async def export_video(task_id: str, request: ExportRequest, background_tasks: BackgroundTasks):
    try:
        task = await task_manager.get_task(task_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f'任务未完成，当前状态: {task.status}')
    export_id = await task_manager.create_export(task_id)
    background_tasks.add_task(process_export_task, export_id, task_id, request)
    return ExportResponse(export_id=export_id, status=TaskStatus.PENDING,
                          estimated_time=30, message='视频正在导出中，请稍候')


@router.get('/api/v1/exports/{export_id}', tags=['视频导出'])
async def get_export_status(export_id: str):
    try:
        task = await task_manager.get_export(export_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    result = {key: task[key] for key in ('export_id', 'status', 'progress', 'created_at', 'updated_at')}
    if task['status'] == 'completed':
        result['download_url'] = f'/api/v1/exports/{export_id}/download'
    if task['error']:
        result['error'] = task['error']
    return result


@router.get('/api/v1/exports/{export_id}/download', tags=['视频导出'])
async def download_export(export_id: str):
    try:
        task = await task_manager.get_export(export_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    if task['status'] != 'completed':
        raise HTTPException(status_code=400, detail=f"视频尚未导出完成，当前状态: {task['status']}")
    output = Path(task['output_file']) if task['output_file'] else None
    if not output or not output.is_file():
        raise HTTPException(status_code=404, detail='导出文件不存在')
    media_type = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo'}[output.suffix]
    return FileResponse(str(output), media_type=media_type, filename=f'onetake_export_{output.name}')
