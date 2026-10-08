#!/bin/bash
# One Take 视频自动剪辑系统 - 快速演示脚本

set -e
cd "$(dirname "$0")"

echo "🎬 One Take 视频自动剪辑系统 - 快速演示"
echo "========================================"
echo ""

echo "📦 安装锁定的 Python 依赖..."
uv sync --locked

echo ""
echo "📌 检查 Python 版本..."
uv run --locked python --version

echo ""
echo "🎙️  生成测试音频（可选，需要 edge-tts）..."
echo "提示: 如果没有安装 edge-tts，可以使用自己的音频文件"
read -p "是否生成测试音频? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]
then
    uv run --locked --with edge-tts python generate_test_audio.py --output test_audio.mp3
    AUDIO_FILE="test_audio.mp3"
else
    read -p "请输入音频文件路径: " AUDIO_FILE
fi

echo ""
echo "🚀 运行 ASR 演示..."
uv run --locked python asr_demo.py --input "$AUDIO_FILE" --output result.json --pretty --model base

echo ""
echo "✨ 演示完成！"
echo ""
echo "📄 查看结果:"
echo "   cat result.json"
echo ""
echo "🔍 查看格式化的 JSON:"
echo "   uv run --locked python -m json.tool result.json"
