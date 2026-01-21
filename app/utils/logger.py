"""
One Take API - 统一日志模块
支持控制台和文件输出，日志轮转
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from app.config import settings


def setup_logger(
    name: str = "onetake",
    level: int = logging.INFO,
    log_dir: Path = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5
) -> logging.Logger:
    """
    设置统一的日志器
    
    Args:
        name: 日志器名称
        level: 日志级别
        log_dir: 日志文件目录
        max_bytes: 单个日志文件最大字节数
        backup_count: 保留的备份文件数量
    
    Returns:
        配置好的 Logger 实例
    """
    logger = logging.getLogger(name)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    logger.setLevel(level)
    
    # 日志格式
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件输出（如果指定了日志目录）
    if log_dir:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"{name}.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8"
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


# 默认日志器实例
log_level = logging.DEBUG if settings.debug else logging.INFO
log_dir = settings.storage_path / "logs" if hasattr(settings, 'storage_path') else None

logger = setup_logger(
    name="onetake",
    level=log_level,
    log_dir=log_dir
)


def get_logger(name: str) -> logging.Logger:
    """
    获取子日志器
    
    Args:
        name: 子日志器名称（如 "onetake.api"）
    
    Returns:
        Logger 实例
    """
    return logging.getLogger(f"onetake.{name}")
