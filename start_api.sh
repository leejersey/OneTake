#!/bin/bash
# One Take API 启动脚本

cd "$(dirname "$0")"

echo "🚀 启动 One Take API 服务..."
echo "📍 访问 http://localhost:8000/docs 查看 API 文档"
echo ""

# 使用 uvicorn 模块方式启动
exec uv run --locked uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
