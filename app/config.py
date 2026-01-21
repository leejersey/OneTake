"""
One Take API - 配置管理
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""
    
    # 应用配置
    app_name: str = "One Take API"
    version: str = "2.0.0"
    debug: bool = False
    
    # 存储配置
    storage_path: Path = Path("./storage")
    max_file_size: int = 500 * 1024 * 1024  # 500MB
    
    # ASR 配置
    whisper_model: str = "medium"  # 升级到 medium 模型，准确率 ~95%
    whisper_device: str = "auto"
    
    # FFmpeg 配置
    ffmpeg_path: str = "ffmpeg"
    
    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8000
    
    # 数据库配置（默认使用 SQLite，无需安装数据库服务）
    database_url: str = "sqlite+aiosqlite:///./storage/onetake.db"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
    
    def ensure_storage_paths(self):
        """确保存储目录存在"""
        (self.storage_path / "uploads").mkdir(parents=True, exist_ok=True)
        (self.storage_path / "results").mkdir(parents=True, exist_ok=True)
        (self.storage_path / "exports").mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_storage_paths()
