# FFmpeg 视频剪辑功能测试指南

## 完整工作流测试

### 前提条件

1. **准备测试视频文件**（而不是音频）
2. **启动 API 服务**

```bash
uv sync --locked
uv run --locked python run.py
```

## 测试流程

### 步骤 1: 生成测试视频（可选）

如果没有测试视频，可以用 FFmpeg 从音频生成一个简单的视频：

```bash
ffmpeg -loop 1 -i poster.jpg -i test_audio.mp3 \
  -c:v libx264 -tune stillimage -c:a aac -b:a 192k \
  -pix_fmt yuv420p -shortest test_video.mp4
```

或使用纯色背景：

```bash
ffmpeg -f lavfi -i color=c=blue:s=1280x720:d=40 \
  -i test_audio.mp3 -c:v libx264 -c:a aac \
  -shortest test_video.mp4
```

### 步骤 2: 上传视频

```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@test_video.mp4" \
  -F "language=zh"
```

**响应示例**：
```json
{
  "task_id": "abc123...",
  "status": "pending",
  "uploaded_at": "2026-01-18T23:15:00",
  "message": "文件上传成功（5.21MB），正在处理中"
}
```

保存返回的 `task_id`。

### 步骤 3: 等待 ASR 处理完成

轮询任务状态：

```bash
curl http://localhost:8000/api/v1/tasks/{task_id}
```

等待 `status` 变为 `"completed"`。

### 步骤 4: 请求视频导出

使用自动生成的 EDL：

```bash
curl -X POST http://localhost:8000/api/v1/tasks/{task_id}/export \
  -H "Content-Type: application/json" \
  -d '{
    "format": "mp4",
    "quality": "high"
  }'
```

**响应示例**：
```json
{
  "export_id": "xyz789...",
  "status": "pending",
  "estimated_time": 30,
  "message": "视频正在导出中，请稍候"
}
```

保存返回的 `export_id`。

### 步骤 5: 查询导出状态

```bash
curl http://localhost:8000/api/v1/exports/{export_id}
```

**处理中时的响应**：
```json
{
  "export_id": "xyz789...",
  "status": "processing",
  "progress": 50,
  "created_at": "...",
  "updated_at": "..."
}
```

**完成后的响应**：
```json
{
  "export_id": "xyz789...",
  "status": "completed",
  "progress": 100,
  "download_url": "/api/v1/exports/xyz789.../download",
  "created_at": "...",
  "updated_at": "..."
}
```

### 步骤 6: 下载剪辑后的视频

```bash
curl -O -J -L http://localhost:8000/api/v1/exports/{export_id}/download
```

或在浏览器中直接访问：
```
http://localhost:8000/api/v1/exports/{export_id}/download
```

## 高级用法

### 使用自定义 EDL

如果您修改了 EDL（例如手动调整了哪些词要删除），可以在导出时提供自定义 EDL：

```bash
curl -X POST http://localhost:8000/api/v1/tasks/{task_id}/export \
  -H "Content-Type: application/json" \
  -d '{
    "edl": {
      "words": [...],
      "duration": 36.82,
      ...
    },
    "format": "mp4",
    "quality": "medium"
  }'
```

### 质量选项

- **high**: CRF 18, 慢速编码，最佳质量
- **medium**: CRF 23, 中速编码，平衡
- **low**: CRF 28, 快速编码，较小文件

## Python 客户端示例

```python
import requests
import time

# 1. 上传视频
with open('test_video.mp4', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/api/v1/upload',
        files={'file': f},
        data={'language': 'zh'}
    )
    task_id = response.json()['task_id']

# 2. 等待 ASR 完成
while True:
    response = requests.get(f'http://localhost:8000/api/v1/tasks/{task_id}')
    task = response.json()
    if task['status'] == 'completed':
        break
    time.sleep(2)

# 3. 请求导出
response = requests.post(
    f'http://localhost:8000/api/v1/tasks/{task_id}/export',
    json={'format': 'mp4', 'quality': 'high'}
)
export_id = response.json()['export_id']

# 4. 等待导出完成
while True:
    response = requests.get(f'http://localhost:8000/api/v1/exports/{export_id}')
    export = response.json()
    print(f"进度: {export['progress']}%")
    if export['status'] == 'completed':
        break
    time.sleep(3)

# 5. 下载视频
response = requests.get(
    f'http://localhost:8000/api/v1/exports/{export_id}/download',
    stream=True
)
with open('output_video.mp4', 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)

print("✅ 视频下载完成！")
```

## 故障排查

### 错误: "原始文件不是视频，无法剪辑"

**原因**: 上传的是音频文件，不是视频

**解决**: 使用视频文件（.mp4, .avi, .mov）

### 错误: "FFmpeg 失败"

**可能原因**:
- FFmpeg 未正确安装
- 视频编码不兼容
- 磁盘空间不足

**解决**:
1. 检查 FFmpeg: `ffmpeg -version`
2. 检查磁盘空间: `df -h`
3. 查看详细错误信息

### 导出很慢

**原因**: 视频重编码需要时间

**优化**:
- 使用 stream copy（仅在不需要重编码时）
- 降低质量设置（使用 "low"）
- 使用更快的机器或 GPU 加速

## API 端点汇总

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/tasks/{id}/export` | POST | 请求导出视频 |
| `/api/v1/exports/{id}` | GET | 查询导出状态 |
| `/api/v1/exports/{id}/download` | GET | 下载视频 |

## 预期效果

剪辑后的视频应该：
- ✅ 移除了 EDL 中标记为 `auto_delete: true` 的词对应的视频片段
- ✅ 移除了长时间的静音段
- ✅ 保留了正常的语音内容
- ✅ 音视频同步正常
- ✅ 文件可正常播放

---

**注意**: 首次剪辑可能需要较长时间，具体取决于视频长度和质量设置。
