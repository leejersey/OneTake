<div align="center">

# 🎬 One Take 视频自动剪辑系统

**一镜到底，智能清洗** - 基于 AI 的文本化视频编辑工具

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.2+-61DAFB.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [API 文档](#-api-文档) • [常见问题](#-常见问题)

</div>

---

## 📖 目录

- [项目简介](#项目简介)
- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [系统要求](#-系统要求)
- [快速开始](#-快速开始)
- [详细安装](#-详细安装)
- [使用指南](#-使用指南)
- [项目结构](#-项目结构)
- [API 文档](#-api-文档)
- [环境变量](#-环境变量)
- [常见问题](#-常见问题)
- [故障排查](#-故障排查)
- [开发指南](#-开发指南)
- [贡献指南](#-贡献指南)
- [路线图](#-路线图)
- [许可证](#-许可证)

---

## 项目简介

**One Take** 是一个创新的视频自动剪辑系统，它改变了传统的视频编辑方式。通过 AI 语音识别技术，将视频转换为可编辑的文本，让你可以像编辑文档一样编辑视频 - **删除文字即删除对应的视频片段**。

### 🎯 适用场景

- **教学视频** - 快速清除口误、重复内容
- **访谈/播客** - 移除废话、语气词
- **演讲录制** - 去除静音段、停顿
- **Vlog 制作** - 高效剪辑，保持流畅性

### ✨ 核心优势

- ⚡ **极速编辑**：30 分钟视频，5 分钟剪辑完成
- 🎯 **精准定位**：字级时间戳，精度 < 100ms
- 🔄 **无损剪辑**：基于 FFmpeg，保持原始质量
- 📝 **可视化编辑**：波形图 + 视频预览 + 文本同步

---

## ✨ 功能特性

### 核心功能

- 🎤 **智能语音识别**
  - 基于 faster-whisper 的高精度 ASR
  - 字级时间戳精度 < 100ms
  - 支持多种语言（中文、英文等）
  - 4 种模型可选（Tiny/Base/Medium/Large）

- 🔇 **智能内容检测**
  - 自动识别语气词（呃、嗯、那个）
  - 静音段自动检测
  - 重复内容识别
  - 可自定义检测规则

- ✂️ **文本化视频剪辑**
  - 点击文字标记删除
  - 双击编辑文字内容
  - 支持批量操作
  - 撤销/重做功能（Ctrl+Z / Ctrl+Shift+Z）

- 🎵 **可视化编辑界面**
  - Wavesurfer.js 波形图显示
  - 视频预览播放器
  - 文字-播放同步高亮
  - 虚拟化列表支持长文本

- 📝 **字幕生成与定制**
  - 自动生成 SRT 字幕
  - 视频比例自动适配（9:16 竖屏 / 16:9 横屏）
  - 字体、颜色、位置可定制
  - 支持软字幕嵌入

- 📊 **任务管理**
  - 历史任务持久化存储
  - 支持继续编辑
  - 任务状态实时跟踪
  - WebSocket 实时进度推送

- 🌙 **用户体验**
  - 深色模式界面
  - 响应式设计
  - 键盘快捷键支持
  - 错误提示友好

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `空格` | 播放/暂停 |
| `←` / `→` | 快退/快进 5秒 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `鼠标点击` | 标记删除 |
| `鼠标双击` | 编辑文字 |

---

## 🛠️ 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| **Python** | 3.10+ | 核心语言 |
| **FastAPI** | 0.104+ | Web 框架 |
| **faster-whisper** | 1.0+ | 语音识别 |
| **PyTorch** | 2.0+ | 深度学习引擎 |
| **FFmpeg** | 4.0+ | 视频处理 |
| **SQLAlchemy** | 2.0+ | ORM 框架 |
| **SQLite/PostgreSQL** | - | 数据库 |
| **Uvicorn** | 0.24+ | ASGI 服务器 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19.2+ | UI 框架 |
| **Vite** | 7.2+ | 构建工具 |
| **Wavesurfer.js** | 7.12+ | 波形可视化 |
| **Axios** | 1.13+ | HTTP 客户端 |
| **React Router** | 7.12+ | 路由管理 |
| **React Window** | 1.8+ | 虚拟化列表 |

### 基础设施

- **Docker** & **Docker Compose** - 容器化部署
- **Nginx** - 反向代理（可选）
- **GitHub Actions** - CI/CD（可选）

---

## 💻 系统要求

### 最低配置

| 项目 | 要求 |
|------|------|
| **操作系统** | macOS 10.15+ / Ubuntu 20.04+ / Windows 10+ (WSL2) |
| **Python** | 3.10 或更高 |
| **Node.js** | 16.0 或更高 |
| **内存** | 8 GB RAM |
| **存储空间** | 10 GB 可用空间（含模型） |
| **FFmpeg** | 4.0 或更高 |

### 推荐配置

| 项目 | 要求 |
|------|------|
| **CPU** | 8 核心或更高 |
| **GPU** | NVIDIA GPU + CUDA 11.8+（可选，加速 ASR） |
| **内存** | 16 GB RAM 或更高 |
| **存储空间** | SSD，20 GB+ 可用空间 |

### ASR 模型性能对比

| 模型 | 准确率 | 速度 | 内存占用 | 推荐场景 |
|------|--------|------|----------|----------|
| **Tiny** | ~80% | 最快 | ~1 GB | 快速预览 |
| **Base** | ~85% | 快 | ~1.5 GB | 日常使用 |
| **Medium** | ~95% | 中等 | ~5 GB | 推荐默认 |
| **Large** | ~98% | 慢 | ~10 GB | 高质量需求 |

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

最简单的启动方式，适合快速体验和生产部署：

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/agentPy.git
cd agentPy

# 2. 复制环境变量配置
cp .env.example .env

# 3. 一键启动
docker compose up -d

# 4. 查看日志
docker compose logs -f
```

访问 http://localhost:3000 即可使用！

### 方式二：本地开发

适合开发者和自定义需求：

```bash
# 1. 安装 uv（Linux 见 UV_GUIDE.md）
brew install uv

# 2. 安装锁定的后端依赖（自动创建 Python 3.10 .venv）
uv sync --locked

# 3. 安装 FFmpeg
# macOS
brew install ffmpeg libass

# Ubuntu/Debian
sudo apt-get install ffmpeg libass-dev

# 4. 启动后端
uv run --locked python run.py

# 5. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

---

## 📦 详细安装

<details>
<summary><b>macOS 安装指南</b></summary>

### 1. 安装 Homebrew（如未安装）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装依赖

```bash
# uv 自动选择或下载 Python 3.10
brew install uv

# 安装 FFmpeg
brew install ffmpeg libass

# 安装 Node.js
brew install node
```

### 3. 创建环境并安装锁定的依赖

```bash
uv sync --locked
```

无需激活环境；配置与依赖更新见 [uv 环境指南](UV_GUIDE.md)。

### 5. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，根据需要调整配置
```

### 6. 初始化数据库

```bash
uv run --locked python -c "from app.database import init_db; import asyncio; asyncio.run(init_db())"
```

### 7. 启动服务

```bash
# 后端
uv run --locked python run.py

# 前端（新终端）
cd frontend && npm install && npm run dev
```

</details>

<details>
<summary><b>Ubuntu/Debian 安装指南</b></summary>

### 1. 更新系统

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. 安装系统依赖

```bash
# 安装 uv（缺少 Python 3.10 时由 uv 自动下载）
curl -LsSf https://astral.sh/uv/install.sh | sh

# FFmpeg 和字幕支持
sudo apt-get install -y ffmpeg libass-dev

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. 创建环境并安装锁定的依赖

```bash
uv sync --locked
```

### 5. 配置环境变量

```bash
cp .env.example .env
nano .env  # 编辑配置
```

### 6. 启动服务

```bash
# 后端
uv run --locked python run.py &

# 前端
cd frontend && npm install && npm run dev
```

</details>

<details>
<summary><b>Windows (WSL2) 安装指南</b></summary>

推荐使用 WSL2 + Ubuntu 22.04，然后按照 Ubuntu 安装指南操作。

### 1. 启用 WSL2

```powershell
# 以管理员身份运行 PowerShell
wsl --install
wsl --set-default-version 2
```

### 2. 安装 Ubuntu

```powershell
wsl --install -d Ubuntu-22.04
```

### 3. 进入 WSL

```bash
wsl
```

后续步骤参考 Ubuntu 安装指南。

</details>

---

## 📖 使用指南

### 1. 上传视频

1. 点击「上传视频」按钮
2. 选择视频/音频文件（支持 mp4, mov, avi, mkv, mp3, wav, m4a, flac）
3. 选择 ASR 模型：
   - **Tiny** - 最快，适合预览
   - **Base** - 平衡，日常使用
   - **Medium** - 推荐，高准确率
   - **Large** - 最佳质量
4. 点击「开始处理」

### 2. 等待 ASR 处理

- 实时进度显示
- WebSocket 推送状态更新
- 处理时间取决于视频长度和模型大小

### 3. 编辑转写文本

- **点击词汇** - 标记为删除（红色背景）
- **双击词汇** - 编辑文字内容
- **点击播放器** - 播放视频，文字同步高亮
- **使用快捷键** - Ctrl+Z 撤销，Ctrl+Shift+Z 重做
- **保存修改** - 点击“保存”，查看已保存/未保存状态；刷新读取已保存版本，导出前自动保存

### 4. 配置字幕（可选）

在导出前设置字幕样式：

- **字体大小** - 16-48px
- **字体颜色** - 自由选择
- **字幕位置** - 顶部/中间/底部
- **视频比例** - 自动检测或手动选择

### 5. 导出视频

1. 点击「导出视频」按钮
2. 选择导出质量：
   - **高质量** - 原始比特率
   - **中等质量** - 适中文件大小
   - **快速导出** - 较小文件
3. 等待导出完成
4. 点击「下载」保存文件

API 支持 MP4/MOV/AVI；AVI 使用 PCM 音轨和硬字幕（需要 libass），MP4/MOV 使用软字幕。样式字段目前仍预留，仅字幕开关生效。

新导出状态会持久化；重启后的中断任务标记为失败，首页可重试转写，编辑器可重新导出。清理不会删除数据库引用的媒体，磁盘占用可能持续增长；启动恢复目前仅支持单后端实例。详见 [UV_GUIDE.md](UV_GUIDE.md)。

---

## 📁 项目结构

```
agentPy/
├── app/                          # 后端 FastAPI 应用
│   ├── api/                      # API 端点
│   │   ├── upload.py             # 文件上传
│   │   ├── tasks.py              # 任务管理
│   │   ├── export.py             # 视频导出
│   │   ├── websocket.py          # WebSocket 实时通信
│   │   └── health.py             # 健康检查
│   ├── services/                 # 核心业务服务
│   │   ├── asr_service.py        # ASR 语音识别
│   │   ├── ffmpeg_service.py     # 视频剪辑处理
│   │   ├── subtitle_service.py   # 字幕生成
│   │   ├── detection_service.py  # 内容检测
│   │   └── storage_service.py    # 文件存储
│   ├── utils/                    # 工具类
│   │   ├── validators.py         # 输入验证
│   │   └── helpers.py            # 辅助函数
│   ├── database.py               # 数据库连接
│   ├── db_models.py              # ORM 模型
│   ├── models.py                 # Pydantic 模型
│   ├── config.py                 # 配置管理
│   ├── exceptions.py             # 自定义异常
│   └── main.py                   # FastAPI 应用入口
├── frontend/                     # 前端 React 应用
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   │   ├── Home.jsx          # 主页（上传）
│   │   │   └── Editor.jsx        # 编辑器页面
│   │   ├── components/           # UI 组件
│   │   │   ├── VideoPlayer.jsx   # 视频播放器
│   │   │   ├── Waveform.jsx      # 波形图
│   │   │   └── TranscriptEditor.jsx # 转写编辑器
│   │   ├── api/                  # API 客户端
│   │   ├── contexts/             # React Context
│   │   └── utils/                # 工具函数
│   ├── public/                   # 静态资源
│   ├── package.json              # 前端依赖
│   ├── vite.config.js            # Vite 配置
│   └── Dockerfile                # 前端容器
├── storage/                      # 文件存储目录
│   ├── uploads/                  # 上传文件
│   ├── videos/                   # 导出视频
│   └── onetake.db                # SQLite 数据库
├── tests/                        # 单元测试
│   ├── test_asr.py
│   ├── test_ffmpeg.py
│   └── test_api.py
├── .env.example                  # 环境变量示例
├── .gitignore                    # Git 忽略文件
├── Dockerfile                    # 后端容器
├── docker-compose.yml            # Docker Compose 配置
├── pyproject.toml                # Python 依赖声明
├── uv.lock                       # 可复现的依赖锁文件
├── requirements.txt              # 从 uv.lock 导出的兼容文件
├── run.py                        # 后端启动脚本
├── start_all.sh                  # 一键启动脚本
└── README.md                     # 本文档
```

---

## 🔧 API 文档

启动后端后，访问 **http://localhost:8000/docs** 查看完整的交互式 API 文档（Swagger UI）。

### 核心端点

| 端点 | 方法 | 说明 | 参数 |
|------|------|------|------|
| `/health` | GET | 健康检查 | - |
| `/api/v1/upload` | POST | 上传音视频文件 | `file`, `whisper_model` |
| `/api/v1/tasks` | GET | 获取任务列表 | `skip`, `limit` |
| `/api/v1/tasks/{id}` | GET | 获取任务详情 | `task_id` |
| `/api/v1/tasks/{id}/edl` | GET | 获取 EDL 数据 | `task_id` |
| `/api/v1/tasks/{id}/export` | POST | 导出视频 | `task_id`, `subtitle_config` |
| `/api/v1/tasks/{id}/download` | GET | 下载导出视频 | `task_id` |
| `/ws/tasks/{id}` | WebSocket | 实时进度推送 | `task_id` |

### 请求示例

<details>
<summary><b>上传文件</b></summary>

```bash
curl -X POST "http://localhost:8000/api/v1/upload" \
  -F "file=@video.mp4" \
  -F "whisper_model=medium"
```

响应：
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "File uploaded successfully"
}
```

</details>

<details>
<summary><b>查询任务状态</b></summary>

```bash
curl "http://localhost:8000/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000"
```

响应：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "created_at": "2026-01-21T09:30:00Z",
  "completed_at": "2026-01-21T09:32:15Z"
}
```

</details>

<details>
<summary><b>导出视频</b></summary>

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/550e8400-e29b-41d4-a716-446655440000/export" \
  -H "Content-Type: application/json" \
  -d '{
    "subtitle_config": {
      "enabled": true,
      "font_size": 24,
      "font_color": "#FFFFFF",
      "position": "bottom"
    }
  }'
```

</details>

---

## ⚙️ 环境变量

复制 `.env.example` 为 `.env` 并根据需要调整：

```bash
# 应用配置
APP_NAME=One Take API
VERSION=2.0.0
DEBUG=false

# 存储配置
STORAGE_PATH=./storage
MAX_FILE_SIZE=524288000  # 500MB

# ASR 配置
WHISPER_MODEL=medium     # tiny/base/medium/large
WHISPER_DEVICE=cpu       # cpu/cuda

# FFmpeg 配置
FFMPEG_PATH=ffmpeg       # FFmpeg 可执行文件路径

# 服务器配置
HOST=0.0.0.0
PORT=8000

# 数据库配置
DATABASE_URL=sqlite+aiosqlite:///./storage/onetake.db
# 或使用 PostgreSQL:
# DATABASE_URL=postgresql+asyncpg://user:password@localhost/onetake
```

### 配置说明

| 变量 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| `WHISPER_MODEL` | ASR 模型大小 | medium | tiny/base/medium/large |
| `WHISPER_DEVICE` | 计算设备 | cpu | cpu/cuda |
| `MAX_FILE_SIZE` | 最大上传文件大小（字节） | 524288000 | 任意整数 |
| `DATABASE_URL` | 数据库连接字符串 | SQLite | SQLite/PostgreSQL |
| `DEBUG` | 调试模式 | false | true/false |

---

## ❓ 常见问题

<details>
<summary><b>Q1: ASR 模型下载失败怎么办？</b></summary>

**原因**：网络问题或 Hugging Face 连接受限。

**解决方案**：
1. 使用镜像站点：
   ```bash
   export HF_ENDPOINT=https://hf-mirror.com
   ```

2. 手动下载模型：
   ```bash
   # 访问 https://huggingface.co/guillaumekln/faster-whisper-medium
   # 下载后放置到 ~/.cache/huggingface/hub/
   ```

3. 使用更小的模型（如 base）先测试。

</details>

<details>
<summary><b>Q2: 提示 "FFmpeg not found" 怎么办？</b></summary>

**解决方案**：
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# 验证安装
ffmpeg -version
```

如果已安装但仍报错，设置环境变量：
```bash
export FFMPEG_PATH=/usr/local/bin/ffmpeg
```

</details>

<details>
<summary><b>Q3: 端口 8000 或 5173 已被占用？</b></summary>

**解决方案**：

修改端口：
```bash
# 后端 - 编辑 .env
PORT=8001

# 前端 - 编辑 frontend/vite.config.js
server: {
  port: 5174
}
```

或者杀死占用进程：
```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9
```

</details>

<details>
<summary><b>Q4: 内存不足怎么办？</b></summary>

**解决方案**：
1. 使用更小的 ASR 模型（tiny/base）
2. 减少并发任务数
3. 增加系统 swap 空间：
   ```bash
   # Linux
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

</details>

<details>
<summary><b>Q5: 如何使用 GPU 加速？</b></summary>

**要求**：
- NVIDIA GPU
- CUDA 11.8+
- cuDNN 8.6+

**配置**：
```bash
# 使用锁定的依赖；自定义 CUDA 索引请先阅读 UV_GUIDE.md
uv sync --locked

# 修改 .env
WHISPER_DEVICE=cuda

# 验证
uv run --locked python -c "import torch; print(torch.cuda.is_available())"
```

</details>

<details>
<summary><b>Q6: Docker 容器启动失败？</b></summary>

**常见原因**：
1. Docker 未运行：`docker ps` 测试
2. 端口冲突：修改 `docker-compose.yml` 端口映射
3. 内存不足：增加 Docker 内存限制

**调试**：
```bash
docker-compose logs -f
docker-compose down -v  # 完全重置
```

</details>

---

## 🔍 故障排查

### 日志查看

```bash
# 后端日志（开发模式）
uv run --locked python run.py  # 直接在终端查看

# Docker 日志
docker-compose logs -f api
docker-compose logs -f frontend

# 查看特定容器
docker logs onetake-api --tail 100 -f
```

### 常见错误

| 错误信息 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `ModuleNotFoundError: No module named 'faster_whisper'` | 依赖未安装 | `uv sync --locked` |
| `RuntimeError: CUDA out of memory` | GPU 内存不足 | 使用 CPU 或更小模型 |
| `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'` | FFmpeg 未安装 | 安装 FFmpeg |
| `Connection refused` | 后端未启动 | 启动 `uv run --locked python run.py` |
| `CORS error` | 跨域配置问题 | 检查 `app/main.py` CORS 设置 |

### 性能优化建议

1. **ASR 优化**
   - 使用合适的模型大小（不要总是用 large）
   - GPU 加速（如有条件）
   - 批量处理多个文件

2. **FFmpeg 优化**
   - 使用硬件加速编码（如 h264_videotoolbox）
   - 调整视频比特率
   - 启用多线程

3. **数据库优化**
   - 生产环境使用 PostgreSQL 替代 SQLite
   - 定期清理旧任务
   - 添加索引

4. **前端优化**
   - 启用虚拟化列表（已实现）
   - 懒加载波形图
   - 使用 CDN 托管静态资源

---

## 👨‍💻 开发指南

### 本地开发

```bash
# 1. 克隆代码
git clone https://github.com/yourusername/agentPy.git
cd agentPy

# 2. 创建开发环境（包含测试依赖）
uv sync --locked

# 3. 启动后端（热重载）
uv run --locked uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. 启动前端（热重载）
cd frontend && npm run dev
```

### 运行测试

```bash
# 后端测试（自动使用隔离的临时数据库和存储）
uv run --locked pytest -v

# 单个测试文件
uv run --locked pytest tests/test_ffmpeg_service.py -v

# 覆盖率测试（临时安装可选工具）
uv run --locked --with pytest-cov pytest --cov=app tests/
```

### 代码规范

```bash
# Python 代码格式化
uvx black app/ tests/
uvx flake8 app/ tests/

# JavaScript 代码检查
cd frontend
npm run lint
```

### 添加新功能

1. **后端 API**
   - 在 `app/api/` 创建新端点
   - 在 `app/services/` 实现业务逻辑
   - 更新 `app/models.py` 添加数据模型
   - 在 `tests/` 添加测试

2. **前端组件**
   - 在 `frontend/src/components/` 创建组件
   - 在 `frontend/src/pages/` 组合页面
   - 更新路由配置

---

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

### 提交 Issue

1. 搜索现有 Issue，避免重复
2. 使用 Issue 模板
3. 提供详细的复现步骤
4. 附上错误日志/截图

### 提交 Pull Request

1. **Fork 项目**
   ```bash
   git clone https://github.com/yourusername/agentPy.git
   cd agentPy
   git checkout -b feature/your-feature-name
   ```

2. **开发与测试**
   ```bash
   # 进行修改
   # 运行测试
   uv run --locked pytest tests/
   ```

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

4. **创建 PR**
   - 填写 PR 模板
   - 关联相关 Issue
   - 等待代码审查

### Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具链
```

---

## 🗺️ 路线图

### ✅ 已完成（v2.0）

- [x] 核心 ASR 功能（faster-whisper）
- [x] 字级时间戳提取
- [x] 智能内容检测（语气词、静音）
- [x] FastAPI 后端 API
- [x] React 前端界面
- [x] 文本化视频编辑
- [x] 波形图可视化
- [x] 字幕生成与定制
- [x] 历史任务管理
- [x] Docker 部署支持
- [x] WebSocket 实时进度

### 🚧 进行中（v2.1）

- [ ] 多用户支持与权限管理
- [ ] 云端存储集成（S3/OSS）
- [ ] 批量导出功能
- [ ] 自定义检测规则编辑器

### 📅 计划中（v3.0）

- [ ] 多语言支持（UI 国际化）
- [ ] AI 辅助内容优化建议
- [ ] 说话人识别（diarization）
- [ ] 视频片段重新排序
- [ ] 音乐/音效库集成
- [ ] 移动端 App
- [ ] 浏览器扩展

### 💡 考虑中

- [ ] 实时协作编辑
- [ ] 视频转文章（AI 总结）
- [ ] 自动配音（TTS）
- [ ] 多轨道编辑
- [ ] 插件系统

---

## 📊 性能指标

基于 MacBook Pro (M1 Pro, 16GB RAM) 测试：

| 视频长度 | 模型 | ASR 时间 | 导出时间 | 总耗时 |
|----------|------|----------|----------|--------|
| 5 分钟 | Base | ~45s | ~30s | ~1.5min |
| 5 分钟 | Medium | ~90s | ~30s | ~2min |
| 30 分钟 | Base | ~4.5min | ~3min | ~7.5min |
| 30 分钟 | Medium | ~9min | ~3min | ~12min |

*导出时间取决于剪辑片段数量和目标质量设置*

---

## 🔒 安全性说明

- **文件上传**：限制文件大小（默认 500MB）和类型
- **路径遍历**：所有文件操作使用安全路径验证
- **SQL 注入**：使用 ORM（SQLAlchemy）防护
- **XSS 防护**：React 自动转义输出
- **CORS 配置**：仅允许特定域名跨域请求（生产环境需配置）

### 生产环境建议

1. 启用 HTTPS
2. 配置严格的 CORS 策略
3. 添加 API 认证（JWT/OAuth）
4. 使用环境变量管理敏感信息
5. 定期更新依赖包
6. 启用日志审计

---

## 📚 相关文档

- [API 测试指南](API_TESTING.md) - API 调用示例
- [uv 环境指南](UV_GUIDE.md) - Python 环境、锁文件和依赖管理
- [启动指南](STARTUP.md) - 快速启动脚本
- [项目总结](PROJECT_SUMMARY.md) - 开发历程
- [FFmpeg 测试](FFMPEG_TESTING.md) - 视频处理测试
- [使用示例](EXAMPLES.md) - 完整使用案例

---

## 🙏 致谢

本项目使用了以下优秀的开源项目：

- [faster-whisper](https://github.com/guillaumekln/faster-whisper) - 高性能 ASR 引擎
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [React](https://reactjs.org/) - 用户界面库
- [Wavesurfer.js](https://wavesurfer-js.org/) - 音频波形可视化
- [FFmpeg](https://ffmpeg.org/) - 多媒体处理工具

感谢所有贡献者的辛勤付出！

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

```
MIT License

Copyright (c) 2026 One Take Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

**如有问题或建议，欢迎提交 [Issue](https://github.com/yourusername/agentPy/issues) 或 [PR](https://github.com/yourusername/agentPy/pulls)！**

## 交流
可以关注公众号（零号Ai开发者）关注项目的进度

⭐ 如果这个项目对你有帮助，请给个 Star！

Made with ❤️ by One Take Team

</div>
