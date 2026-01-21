#!/usr/bin/env python3
"""
One Take API 启动脚本
"""

import sys
from pathlib import Path

# 将项目根目录添加到 Python 路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    
    print(f"🚀 {settings.app_name} v{settings.version} 启动中...")
    print(f"📍 文档: http://{settings.host}:{settings.port}/docs")
    print(f"📊 健康检查: http://{settings.host}:{settings.port}/health")
    print()
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
