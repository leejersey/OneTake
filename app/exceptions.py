"""
One Take API - 自定义异常类
"""

from typing import Optional


class OneTakeException(Exception):
    """基础异常类"""
    
    def __init__(self, message: str, code: str = "UNKNOWN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class TaskNotFoundError(OneTakeException):
    """任务不存在"""
    
    def __init__(self, task_id: str):
        super().__init__(
            message=f"任务 {task_id} 不存在",
            code="TASK_NOT_FOUND"
        )
        self.task_id = task_id


class FileNotFoundError(OneTakeException):
    """文件不存在"""
    
    def __init__(self, file_path: str):
        super().__init__(
            message=f"文件不存在: {file_path}",
            code="FILE_NOT_FOUND"
        )
        self.file_path = file_path


class InvalidFileTypeError(OneTakeException):
    """不支持的文件类型"""
    
    def __init__(self, file_ext: str, allowed: list):
        super().__init__(
            message=f"不支持的文件类型 {file_ext}，支持的类型: {', '.join(allowed)}",
            code="INVALID_FILE_TYPE"
        )
        self.file_ext = file_ext
        self.allowed = allowed


class FileTooLargeError(OneTakeException):
    """文件过大"""
    
    def __init__(self, size: int, max_size: int):
        super().__init__(
            message=f"文件过大 ({size / 1024 / 1024:.2f}MB)，最大允许 {max_size / 1024 / 1024}MB",
            code="FILE_TOO_LARGE"
        )
        self.size = size
        self.max_size = max_size


class ASRProcessingError(OneTakeException):
    """ASR 处理失败"""
    
    def __init__(self, message: str, task_id: Optional[str] = None):
        super().__init__(
            message=f"ASR 处理失败: {message}",
            code="ASR_PROCESSING_ERROR"
        )
        self.task_id = task_id


class ExportError(OneTakeException):
    """导出失败"""
    
    def __init__(self, message: str, export_id: Optional[str] = None):
        super().__init__(
            message=f"视频导出失败: {message}",
            code="EXPORT_ERROR"
        )
        self.export_id = export_id


class FFmpegNotFoundError(OneTakeException):
    """FFmpeg 不可用"""
    
    def __init__(self):
        super().__init__(
            message="FFmpeg 未安装或不可用",
            code="FFMPEG_NOT_FOUND"
        )
