"""
One Take API - 任务清理服务
自动清理过期任务和文件
"""

import asyncio
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from app.config import settings
from app.utils.logger import get_logger

logger = get_logger("cleanup")


class CleanupService:
    """任务清理服务"""
    
    def __init__(
        self,
        storage_path: Path = None,
        max_age_hours: int = 24,
        check_interval_minutes: int = 30
    ):
        """
        初始化清理服务
        
        Args:
            storage_path: 存储根目录
            max_age_hours: 最大保留时间（小时）
            check_interval_minutes: 检查间隔（分钟）
        """
        self.storage_path = storage_path or settings.storage_path
        self.max_age = timedelta(hours=max_age_hours)
        self.check_interval = check_interval_minutes * 60  # 转换为秒
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """启动清理服务"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._cleanup_loop())
        logger.info(f"清理服务已启动 (保留 {self.max_age.total_seconds() / 3600:.0f} 小时)")
    
    async def stop(self):
        """停止清理服务"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("清理服务已停止")
    
    async def _cleanup_loop(self):
        """清理循环"""
        while self._running:
            try:
                await self.cleanup_once()
            except Exception as e:
                logger.error(f"清理过程出错: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    async def cleanup_once(self):
        """执行一次清理"""
        now = datetime.now()
        cutoff = now - self.max_age
        
        cleaned_uploads = await self._cleanup_directory(
            self.storage_path / "uploads",
            cutoff
        )
        
        cleaned_exports = await self._cleanup_directory(
            self.storage_path / "exports",
            cutoff
        )
        
        cleaned_results = await self._cleanup_directory(
            self.storage_path / "results",
            cutoff
        )
        
        total = cleaned_uploads + cleaned_exports + cleaned_results
        if total > 0:
            logger.info(f"清理完成: 删除 {total} 个过期文件")
    
    async def _cleanup_directory(self, dir_path: Path, cutoff: datetime) -> int:
        """
        清理指定目录中的过期文件
        
        Args:
            dir_path: 目录路径
            cutoff: 截止时间
        
        Returns:
            删除的文件数量
        """
        if not dir_path.exists():
            return 0
        
        count = 0
        for item in dir_path.iterdir():
            try:
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime < cutoff:
                    if item.is_file():
                        item.unlink()
                    elif item.is_dir():
                        shutil.rmtree(item)
                    count += 1
                    logger.debug(f"已删除过期文件: {item.name}")
            except Exception as e:
                logger.warning(f"删除文件失败 {item}: {e}")
        
        return count


# 全局清理服务实例
cleanup_service = CleanupService()
