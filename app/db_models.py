"""
One Take API - 数据库 ORM 模型
"""

from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # 关联
    result: Mapped["TaskResult | None"] = relationship("TaskResult", back_populates="task", uselist=False)
    
    def to_dict(self):
        """转换为字典"""
        return {
            "task_id": self.id,
            "file_path": self.file_path,
            "language": self.language,
            "status": self.status,
            "progress": self.progress,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class ExportTask(Base):
    """Persistent export state, independent of process memory."""
    __tablename__ = "export_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_file: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    def to_dict(self):
        return {"export_id": self.id, "task_id": self.task_id, "status": self.status,
                "progress": self.progress, "error": self.error, "output_file": self.output_file,
                "created_at": self.created_at, "updated_at": self.updated_at}


class TaskResult(Base):
    """任务结果表（存储 EDL JSON）"""
    __tablename__ = "task_results"
    
    task_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("tasks.id", ondelete="CASCADE"), 
        primary_key=True
    )
    edl_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    
    # 关联
    task: Mapped["Task"] = relationship("Task", back_populates="result")
