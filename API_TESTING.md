# One Take API 快速测试指南

## 启动服务

```bash
# 激活 conda 环境
conda activate onetake

# 启动 FastAPI 服务
python app/main.py

# 或使用 uvicorn 直接启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务将在 `http://localhost:8000` 启动。

## API 文档

访问自动生成的 API 文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 测试示例

### 1. 健康检查

```bash
curl http://localhost:8000/health
```

**响应示例**:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2026-01-18T22:55:00"
}
```

### 2. 上传音频文件

```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@test_audio.mp3" \
  -F "language=zh"
```

**响应示例**:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "uploaded_at": "2026-01-18T22:55:00",
  "message": "文件上传成功（0.21MB），正在处理中"
}
```

### 3. 查询任务状态

```bash
curl http://localhost:8000/api/v1/tasks/{task_id}
```

**处理中的响应**:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 50,
  "created_at": "2026-01-18T22:55:00",
  "updated_at": "2026-01-18T22:55:10"
}
```

**完成后的响应**:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "transcript": "大家好, 我是...",
  "statistics": {
    "total_words": 108,
    "filler_count": 2,
    "silence_count": 6,
    "suggested_cuts": 2,
    "original_duration": 36.82,
    "estimated_final_duration": 36.34,
    "time_saved": 0.48,
    "compression_ratio": 98.7
  },
  "edl_url": "/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000/edl",
  "created_at": "2026-01-18T22:55:00",
  "updated_at": "2026-01-18T22:56:00"
}
```

### 4. 获取 EDL 数据

```bash
curl http://localhost:8000/api/v1/tasks/{task_id}/edl
```

**响应**: 完整的 EDL JSON（与 asr_demo.py 输出格式相同）

## 使用 httpie 测试（更友好）

```bash
# 安装 httpie
pip install httpie

# 测试 API
http GET localhost:8000/health
http POST localhost:8000/api/v1/upload file@test_audio.mp3 language=zh
http GET localhost:8000/api/v1/tasks/{task_id}
```

## Python 客户端示例

```python
import requests
import time

# 1. 上传文件
with open('test_audio.mp3', 'rb') as f:
    files = {'file': f}
    data = {'language': 'zh'}
    response = requests.post('http://localhost:8000/api/v1/upload', files=files, data=data)
    task_id = response.json()['task_id']
    print(f"任务 ID: {task_id}")

# 2. 轮询任务状态
while True:
    response = requests.get(f'http://localhost:8000/api/v1/tasks/{task_id}')
    result = response.json()
    
    print(f"状态: {result['status']}, 进度: {result['progress']}%")
    
    if result['status'] == 'completed':
        print(f"转写完成！共 {result['statistics']['total_words']} 个词")
        break
    elif result['status'] == 'failed':
        print(f"处理失败: {result['error']}")
        break
    
    time.sleep(2)

# 3. 获取 EDL
edl_response = requests.get(f'http://localhost:8000/api/v1/tasks/{task_id}/edl')
edl = edl_response.json()
print(f"EDL 数据长度: {len(edl['words'])} 个词")
```

## 支持的文件格式

- 音频: `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`
- 视频: `.mp4`, `.avi`, `.mov`

## 文件大小限制

- 默认最大: 500MB
- 可在 `.env` 文件中修改 `MAX_FILE_SIZE`

## 错误处理

### 文件类型不支持
```json
{
  "detail": "不支持的文件类型 .txt。支持的类型：.mp3, .wav, ..."
}
```

### 文件过大
```json
{
  "detail": "文件过大（600.00MB），最大允许 500MB"
}
```

### 任务不存在
```json
{
  "detail": "任务 xxx-xxx-xxx 不存在"
}
```

## 性能参考

| 音频时长 | 处理时间 (CPU) | 处理时间 (GPU) |
|---------|---------------|---------------|
| 30 秒 | ~10-15 秒 | ~3-5 秒 |
| 1 分钟 | ~20-30 秒 | ~6-10 秒 |
| 5 分钟 | ~2-3 分钟 | ~30-60 秒 |

*基于 base 模型的估算值*

## 开发调试

启动开发模式（自动重载）：

```bash
uvicorn app.main:app --reload --log-level debug
```

查看日志：
- 请求日志会实时显示在控制台
- 可以在 `.env` 中设置 `DEBUG=True` 开启调试模式
