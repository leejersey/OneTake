# 完整功能测试指南

## 测试准备

### 1. 同步 uv 环境

```bash
uv sync --locked
```

无需激活 Conda，安装方法见 [uv 环境指南](UV_GUIDE.md)。

### 2. 启动后端 API 服务

```bash
# 在终端 1
cd /Users/lizexi/Documents/AI/agentPy
uv run --locked python run.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 启动前端开发服务器

```bash
# 在终端 2
cd /Users/lizexi/Documents/AI/agentPy/frontend
npm run dev
```

前端将在 `http://localhost:5173` 启动。

## 完整测试流程

### 步骤 1: 访问首页

打开浏览器访问 http://localhost:5173

您应该看到：
- 标题："One Take 视频编辑器"
- 文件上传按钮
- 上传并开始按钮

### 步骤 2: 上传测试文件

**选项 A: 使用现有的测试音频**
```bash
# 测试音频文件位于
/Users/lizexi/Documents/AI/agentPy/test_audio.mp3
```

**选项 B: 生成测试视频（推荐）**
```bash
# 从音频生成简单视频
ffmpeg -loop 1 -framerate 1 -i placeholder.jpg -i test_audio.mp3 \
  -c:v libx264 -tune stillimage -c:a aac -b:a 192k \
  -pix_fmt yuv420p -shortest -t 40 test_video.mp4
```

或使用纯色背景：
```bash
ffmpeg -f lavfi -i color=c=blue:s=1280x720:d=40 \
  -i test_audio.mp3 -c:v libx264 -c:a aac \
  -pix_fmt yuv420p -shortest test_video.mp4
```

### 步骤 3: 上传并等待处理

1. 点击文件输入，选择 `test_audio.mp3` 或 `test_video.mp4`
2. 确认文件大小显示正确
3. 点击"上传并开始"
4. 等待进度显示：
   - "正在上传..."
   - "上传成功，正在处理..."
   - "处理中... XX%"
   - "处理完成！"
5. 页面将自动跳转到编辑器

### 步骤 4: 编辑逐字稿

在编辑器页面，您应该看到：

**统计信息框**：
- 总词数
- 语气词数
- 静音段数
- 原始时长和预估时长

**逐字稿**：
- 每个词显示为一个方块（badge）
- 语气词有红色背景
- 已标记删除的词有删除线

**交互**：
1. **点击任意词** - 切换删除状态
2. **观察变化** - 词会显示/隐藏删除线
3. **尝试编辑** - 删除一些词，保留一些词

### 步骤 5: 导出视频（仅视频文件）

> **注意**：只有上传的是视频文件才能导出

1. 点击"导出视频"按钮
2. 观察浏览器控制台（F12）
3. 等待导出完成（控制台会显示进度）
4. 导出完成后会自动打开下载链接

### 步骤 6: 验证结果

**检查点**：
- ✅ 文件上传成功
- ✅ ASR 转写完成
- ✅ 逐字稿正确显示
- ✅ 语气词被标记（红色背景）
- ✅ 点击切换删除状态工作正常
- ✅ 统计信息准确
- ✅ 导出功能正常（如果是视频）
- ✅ 下载的视频能正常播放

## 常见问题

### 前端无法连接到后端

**错误**: Network Error 或 CORS 错误

**解决**:
1. 确认后端服务在运行（http://localhost:8000/health 应该返回 OK）
2. 检查前端的 API 配置
3. 后端已配置 CORS，应该不会有跨域问题

### 上传后一直停在"处理中"

**原因**: ASR 处理需要时间

**解决**:
- 等待更长时间（30秒音频 ≈ 10-20秒处理时间）
- 检查后端控制台是否有错误
- 手动访问 `http://localhost:8000/api/v1/tasks/{task_id}` 查看状态

### 导出失败："原始文件不是视频"

**原因**: 上传的是音频文件

**解决**: 
- 使用上面的 FFmpeg 命令生成测试视频
- 或使用真实的视频文件

## 快速测试命令

**一键启动所有服务**（需要两个终端）:

终端 1（后端）:
```bash
cd /Users/lizexi/Documents/AI/agentPy && uv run --locked python run.py
```

终端 2（前端）:
```bash
cd /Users/lizexi/Documents/AI/agentPy/frontend && npm run dev
```

## API 直接测试（可选）

如果前端有问题，可以直接测试 API：

```bash
# 健康检查
curl http://localhost:8000/health

# 上传文件
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@test_audio.mp3" \
  -F "language=zh"

# 查询任务（替换 task_id）
curl http://localhost:8000/api/v1/tasks/{task_id}

# 获取 EDL
curl http://localhost:8000/api/v1/tasks/{task_id}/edl
```

---

**准备好了！请按照上述步骤测试** 🚀
