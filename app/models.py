"""
One Take API - 数据模型定义
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadResponse(BaseModel):
    """文件上传响应"""
    task_id: str
    status: TaskStatus
    uploaded_at: datetime
    message: str = "文件上传成功，正在处理中"


class TaskStatistics(BaseModel):
    """任务统计信息"""
    total_words: int
    filler_count: int
    silence_count: int
    suggested_cuts: int
    original_duration: float
    estimated_final_duration: float
    time_saved: float
    compression_ratio: float


class TaskResult(BaseModel):
    """任务结果"""
    task_id: str
    status: TaskStatus
    progress: int = Field(ge=0, le=100, description="进度百分比")
    transcript: Optional[str] = None
    statistics: Optional[TaskStatistics] = None
    edl_url: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExportFormat(str, Enum):
    """导出格式"""
    MP4 = "mp4"
    AVI = "avi"
    MOV = "mov"


class ExportQuality(str, Enum):
    """导出质量"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SubtitleConfig(BaseModel):
    """字幕配置"""
    enabled: bool = True
    font_name: str = Field(default="Arial", min_length=1, max_length=128, pattern=r'^[^,\r\n\\{}]+$')
    font_size: Optional[int] = Field(default=None, ge=8, le=160)
    color: str = Field(default="#FFFFFF", pattern=r'^#[0-9a-fA-F]{6}$')
    outline_color: str = Field(default="#000000", pattern=r'^#[0-9a-fA-F]{6}$')
    outline_width: int = Field(default=2, ge=0, le=8)
    position: Literal['top', 'center', 'bottom'] = 'bottom'


class EDLWord(BaseModel):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    word: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    auto_delete: bool = False
    user_delete: bool = False

    @model_validator(mode="after")
    def validate_interval(self):
        if self.end < self.start:
            raise ValueError("词结束时间不能早于开始时间")
        return self


class EDLSaveRequest(BaseModel):
    words: list[EDLWord]


class ExportRequest(BaseModel):
    """导出请求"""
    edl: Optional[Dict[str, Any]] = None
    format: ExportFormat = ExportFormat.MP4
    quality: ExportQuality = ExportQuality.HIGH
    subtitle: Optional[SubtitleConfig] = None


class ExportResponse(BaseModel):
    """导出响应"""
    export_id: str
    status: TaskStatus
    estimated_time: int = Field(description="预估时间（秒）")
    message: str = "视频正在导出中"


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str = "ok"
    version: str
    timestamp: datetime
