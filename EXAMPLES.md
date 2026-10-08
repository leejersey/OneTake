# 示例：如何使用 ASR 演示脚本

本文档提供了详细的使用示例和预期输出说明。

## 基础示例

### 1. 最简单的使用

```bash
uv run --locked python asr_demo.py --input your_audio.mp3 --output result.json
```

### 2. 指定中文语言

```bash
uv run --locked python asr_demo.py --input audio.mp3 --language zh --output result.json
```

### 3. 使用更高质量的模型

```bash
uv run --locked python asr_demo.py --input audio.mp3 --model small --output result.json --pretty
```

### 4. 调整静音检测阈值

```bash
# 只标记超过 1 秒的停顿为静音
uv run --locked python asr_demo.py --input audio.mp3 --silence-threshold 1.0
```

## 完整工作流示例

### 方案 1: 使用提供的快速启动脚本

```bash
./quickstart.sh
```

这个脚本会：
1. 检查 Python 环境
2. 安装所有依赖
3. 生成测试音频（可选）
4. 运行 ASR 演示
5. 显示结果

### 方案 2: 手动逐步执行

```bash
# 步骤 1: 安装依赖
uv sync --locked

# 步骤 2: 生成测试音频（需要 edge-tts）
uv run --locked --with edge-tts python generate_test_audio.py --output test.mp3 --language zh

# 步骤 3: 运行 ASR
uv run --locked python asr_demo.py --input test.mp3 --output result.json --pretty

# 步骤 4: 查看结果
uv run --locked python -m json.tool result.json | head -50
```

## 预期输出示例

运行成功后，你会看到类似这样的输出：

```
======================================================================
🎬 One Take 视频自动剪辑系统 - ASR 核心演示
======================================================================
🚀 正在加载 Whisper 模型: base
📱 使用设备: cuda, 计算类型: float16
✅ 模型加载完成

🎤 开始转写音频: /path/to/test.mp3
🌐 自动检测语言...
✅ 检测到语言: zh
📊 语言概率: 99.8%
✅ 转写完成，共 89 个词
🔇 检测到 5 个静音段 (阈值: 0.5s)
💬 检测到 8 个语气词/废话

📋 生成 Edit Decision List...
✅ 结果已保存到: /path/to/result.json

======================================================================
📊 处理统计
======================================================================
总词数:       89
语气词数:     8
静音段数:     5
建议剪切数:   13
原始时长:     45.30s
预估时长:     38.50s
节省时间:     6.80s
压缩率:       85.0%
======================================================================

✨ 处理完成！
```

## JSON 输出结构

生成的 `result.json` 包含以下字段：

```json
{
  "original_audio": "test.mp3",
  "duration": 45.3,
  "transcript": "大家好 我是 Gemini 今天 呃 我要给大家介绍...",
  
  "words": [
    {
      "word": "大家",
      "start": 0.52,
      "end": 0.88,
      "confidence": 0.98,
      "type": "normal",
      "auto_delete": false
    },
    {
      "word": "呃",
      "start": 5.12,
      "end": 5.48,
      "confidence": 0.87,
      "type": "filler",
      "auto_delete": true
    }
  ],
  
  "silence_segments": [
    {
      "start": 10.5,
      "end": 11.3,
      "duration": 0.8,
      "auto_delete": true
    }
  ],
  
  "statistics": {
    "total_words": 89,
    "filler_count": 8,
    "silence_count": 5,
    "suggested_cuts": 13,
    "original_duration": 45.3,
    "estimated_final_duration": 38.5,
    "time_saved": 6.8,
    "compression_ratio": 85.0
  }
}
```

### 关键字段说明

- `auto_delete: true` - 建议删除的片段（语气词或长静音）
- `type: "filler"` - 标记为语气词/废话
- `type: "normal"` - 正常词汇
- `confidence` - ASR 识别置信度（0-1）
- `compression_ratio` - 压缩率，越低表示剪掉的内容越多

## 下一步使用

获得 JSON 后，你可以：

1. **前端展示**: 将 `words` 数据渲染为可编辑的文档
2. **视频剪辑**: 使用 `auto_delete: true` 的片段生成 FFmpeg 剪辑指令
3. **手动调整**: 用户可以修改 `auto_delete` 字段来微调剪辑

## 性能参考

在不同硬件上的处理速度参考：

| 硬件配置 | 模型 | 音频时长 | 处理时间 | 速度比 |
|---------|------|---------|---------|--------|
| MacBook M1 | base | 60s | ~8s | 7.5x |
| RTX 3080 | base | 60s | ~3s | 20x |
| CPU only | base | 60s | ~25s | 2.4x |
| RTX 3080 | small | 60s | ~5s | 12x |

*速度比 = 音频时长 / 处理时间*

## 故障排查

### 问题 1: ModuleNotFoundError: No module named 'faster_whisper'

**解决方案**:
```bash
uv sync --locked
```

### 问题 2: CUDA out of memory

**解决方案**:
```bash
# 使用更小的模型
uv run --locked python asr_demo.py --input audio.mp3 --model tiny

# 或强制使用 CPU
uv run --locked python asr_demo.py --input audio.mp3 --device cpu
```

### 问题 3: 没有检测到任何语音

**可能原因**:
- 音频文件损坏
- 音频格式不支持
- 音频中确实没有语音内容

**解决方案**:
```bash
# 使用 ffmpeg 转换格式
ffmpeg -i input.mp4 -vn -acodec libmp3lame output.mp3
```

### 问题 4: 时间戳不准确

**优化建议**:
- 使用更大的模型（small 或 medium）
- 确保音频质量良好
- 指定正确的语言参数

## 进阶用法

### 批量处理多个文件

```bash
#!/bin/bash
for file in *.mp3; do
    uv run --locked python asr_demo.py --input "$file" --output "${file%.mp3}.json" --pretty
done
```

### 只提取转写文本

```bash
uv run --locked python asr_demo.py --input audio.mp3 --output result.json
cat result.json | uv run --locked python -c "import sys, json; print(json.load(sys.stdin)['transcript'])"
```

### 导出字幕文件（SRT 格式）

可以基于 JSON 数据编写转换脚本：

```python
import json

with open('result.json') as f:
    data = json.load(f)

# 按句子分组（简化示例）
for i, word in enumerate(data['words'], 1):
    start = word['start']
    end = word['end']
    text = word['word']
    
    print(f"{i}")
    print(f"{format_srt_time(start)} --> {format_srt_time(end)}")
    print(f"{text}\n")
```

## 与其他工具集成

### 与 FFmpeg 集成

使用 JSON 数据生成 FFmpeg 剪辑命令：

```python
import json

with open('result.json') as f:
    data = json.load(f)

# 生成保留片段列表
keep_segments = []
for i, word in enumerate(data['words']):
    if not word['auto_delete']:
        keep_segments.append((word['start'], word['end']))

# 生成 FFmpeg concat 文件
with open('segments.txt', 'w') as f:
    for start, end in keep_segments:
        f.write(f"file 'input.mp4'\n")
        f.write(f"inpoint {start}\n")
        f.write(f"outpoint {end}\n")

# 使用 FFmpeg 合并
# ffmpeg -f concat -safe 0 -i segments.txt -c copy output.mp4
```

---

**提示**: 这只是 MVP 阶段的演示脚本。完整的生产系统还需要实现视频处理、前端交互等功能。
