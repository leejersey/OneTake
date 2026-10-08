# One Take API - 启动指南

## 准备环境

在项目根目录运行，安装 uv 和 FFmpeg 的方法见 [uv 环境指南](UV_GUIDE.md)。

```bash
uv sync --locked
cp .env.example .env  # 仅首次配置；已有 .env 不要覆盖
```

无需激活 Conda 或 `.venv`。

## 启动方式

```bash
# 启动脚本（推荐）
uv run --locked python run.py

# 热重载
uv run --locked uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 shell 脚本
./start_api.sh

# 前后端一起启动（前端需先 npm ci）
./start_all.sh
```

不要直接运行 `python app/main.py`；应从项目根目录导入 `app` 包。

## 访问地址

- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc
- 健康检查：http://localhost:8000/health

## 停止和日志

前台运行时按 `Ctrl+C` 停止。后台运行时使用启动时记录的 PID 停止对应进程，避免误停其他服务。

```bash
uv run --locked uvicorn app.main:app --reload --log-level debug > api.log 2>&1
```
