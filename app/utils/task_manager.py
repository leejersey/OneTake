"""
One Take API - 任务管理工具（PostgreSQL 版本）
"""

import uuid
from datetime import datetime
from typing import Dict, Optional
from sqlalchemy import select, update
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import TaskStatus, TaskResult
from app.database import get_session, async_session_maker
from app.db_models import Task, ExportTask, TaskResult as DBTaskResult
from app.utils.logger import get_logger

logger = get_logger("task_manager")


class TaskManager:
    """任务状态管理器（数据库版本）"""
    
    async def create_task(self, file_path: str, language: Optional[str] = None) -> str:
        """创建新任务"""
        task_id = str(uuid.uuid4())
        
        async with async_session_maker() as session:
            task = Task(
                id=task_id,
                file_path=file_path,
                language=language,
                status=TaskStatus.PENDING.value,
                progress=0
            )
            session.add(task)
            await session.commit()
            logger.info(f"创建任务: {task_id}")
        
        return task_id
    
    async def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        result: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        """更新任务状态"""
        async with async_session_maker() as session:
            stmt = select(Task).where(Task.id == task_id)
            db_result = await session.execute(stmt)
            task = db_result.scalar_one_or_none()
            
            if not task:
                raise ValueError(f"任务 {task_id} 不存在")
            
            if status:
                task.status = status.value
            if progress is not None:
                task.progress = progress
            if error:
                task.error = error
            task.updated_at = datetime.now()
            
            # 如果有结果，保存到 task_results 表
            if result:
                await session.merge(DBTaskResult(task_id=task_id, edl_json=result))
            
            await session.commit()
            logger.debug(f"更新任务 {task_id}: status={status}, progress={progress}")
    
    async def get_task(self, task_id: str) -> TaskResult:
        """获取任务信息"""
        async with async_session_maker() as session:
            stmt = select(Task).where(Task.id == task_id)
            result = await session.execute(stmt)
            task = result.scalar_one_or_none()
            
            if not task:
                raise ValueError(f"任务 {task_id} 不存在")
            
            # 获取结果
            result_stmt = select(DBTaskResult).where(DBTaskResult.task_id == task_id)
            result_result = await session.execute(result_stmt)
            task_result = result_result.scalar_one_or_none()
            
            edl_data = task_result.edl_json if task_result else None
            
            # 构建 EDL URL
            edl_url = None
            if task.status == TaskStatus.COMPLETED.value and edl_data:
                edl_url = f"/api/v1/tasks/{task_id}/edl"
            
            return TaskResult(
                task_id=task.id,
                status=TaskStatus(task.status),
                progress=task.progress,
                transcript=edl_data.get("transcript") if edl_data else None,
                statistics=edl_data.get("statistics") if edl_data else None,
                edl_url=edl_url,
                error=task.error,
                created_at=task.created_at,
                updated_at=task.updated_at
            )
    
    async def get_edl(self, task_id: str) -> Dict:
        """获取任务的 EDL 数据"""
        async with async_session_maker() as session:
            stmt = select(DBTaskResult).where(DBTaskResult.task_id == task_id)
            result = await session.execute(stmt)
            task_result = result.scalar_one_or_none()
            
            if not task_result:
                raise ValueError(f"任务 {task_id} 的结果不存在")
            
            return task_result.edl_json
    
    async def save_edl(self, task_id: str, words: list[dict]) -> dict:
        async with async_session_maker() as session:
            task = await session.get(Task, task_id)
            result = await session.get(DBTaskResult, task_id)
            if not task or not result:
                raise LookupError(f"任务 {task_id} 的结果不存在")
            if task.status != TaskStatus.COMPLETED.value:
                raise RuntimeError("只能编辑已完成的任务")
            edl = dict(result.edl_json)
            duration = edl.get('duration', (edl.get('statistics') or {}).get('original_duration'))
            if duration is not None and any(w['end'] > duration for w in words):
                raise ValueError("词时间超过媒体时长")
            if any(a['start'] > b['start'] for a, b in zip(words, words[1:])):
                raise ValueError("词时间必须按顺序排列")
            edl['words'] = words
            edl['transcript'] = ' '.join(w['word'] for w in words)
            result.edl_json = edl
            task.updated_at = datetime.now()
            await session.commit()
            return edl

    async def create_export(self, task_id: str) -> str:
        export_id = str(uuid.uuid4())
        async with async_session_maker() as session:
            session.add(ExportTask(id=export_id, task_id=task_id))
            await session.commit()
        return export_id

    async def get_export(self, export_id: str) -> dict:
        async with async_session_maker() as session:
            item = await session.get(ExportTask, export_id)
            if not item:
                raise ValueError(f"导出任务 {export_id} 不存在")
            return item.to_dict()

    async def update_export(self, export_id: str, **fields):
        async with async_session_maker() as session:
            await session.execute(update(ExportTask).where(ExportTask.id == export_id)
                                  .values(**fields, updated_at=datetime.now()))
            await session.commit()

    async def recover_interrupted_tasks(self):
        # ponytail: recovery assumes one server instance; add leases before multi-instance deployment.
        async with async_session_maker() as session:
            for model in (Task, ExportTask):
                await session.execute(update(model)
                    .where(model.status.in_(['pending', 'processing']))
                    .values(status='failed', error='服务重启，任务已中断，请重试', updated_at=datetime.now()))
            await session.commit()

    async def retry_task(self, task_id: str):
        async with async_session_maker() as session:
            result = await session.execute(update(Task)
                .where(Task.id == task_id, Task.status == 'failed')
                .values(status='pending', progress=0, error=None, updated_at=datetime.now()))
            if result.rowcount != 1:
                raise RuntimeError("只能重试失败的任务")
            await session.commit()

    async def get_protected_files(self) -> tuple[set[Path], set[str]]:
        async with async_session_maker() as session:
            files = (await session.execute(select(Task.file_path))).scalars().all()
            exports = (await session.execute(select(ExportTask))).scalars().all()
            files += [item.output_file for item in exports if item.output_file]
            active = {item.id for item in exports if item.status in ('pending', 'processing')}
            return {Path(file).resolve() for file in files}, active

    async def get_task_info(self, task_id: str) -> Dict:
        """获取任务的原始信息（包括文件路径）"""
        async with async_session_maker() as session:
            stmt = select(Task).where(Task.id == task_id)
            result = await session.execute(stmt)
            task = result.scalar_one_or_none()
            
            if not task:
                raise ValueError(f"任务 {task_id} 不存在")
            
            return task.to_dict()


    async def list_tasks(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """获取任务列表"""
        async with async_session_maker() as session:
            from sqlalchemy import desc
            stmt = select(Task).order_by(desc(Task.created_at)).limit(limit).offset(offset)
            result = await session.execute(stmt)
            tasks = result.scalars().all()
            return [t.to_dict() for t in tasks]


# 全局任务管理器实例
task_manager = TaskManager()
