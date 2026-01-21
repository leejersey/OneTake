#!/bin/bash
# 完整系统测试启动脚本

echo "🚀 One Take 完整系统启动"
echo "======================================"

# 检查 conda 环境
if ! conda info --envs | grep -q "onetake"; then
    echo "❌ 错误: conda 环境 'onetake' 不存在"
    exit 1
fi

echo "✅ Conda 环境检查通过"

# 启动后端
echo ""
echo "📡 启动后端 API 服务 (端口 8000)..."
echo "   访问: http://localhost:8000/docs"
echo ""

# 在后台启动后端
source $(conda info --base)/etc/profile.d/conda.sh
conda activate onetake
python run.py &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
else
    echo "❌ 后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 启动前端
echo ""
echo "🎨 启动前端开发服务器 (端口 5173)..."
echo "   访问: http://localhost:5173"
echo ""

cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "✨ 所有服务已启动！"
echo ""
echo "📍 后端 API: http://localhost:8000"
echo "📍 API 文档: http://localhost:8000/docs"
echo "📍 前端应用: http://localhost:5173"
echo ""
echo "🛑 停止服务: Ctrl+C"
echo "======================================"

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
