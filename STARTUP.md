# One Take API - 启动指南

## 🚀 快速启动

### 方法 1: 使用 Python 启动脚本（推荐）

```bash
conda activate onetake
python run.py
```

### 方法 2: 使用 uvicorn 直接启动

```bash
conda activate onetake
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 方法 3: 使用 shell 脚本

```bash
conda activate onetake
./start_api.sh
```

## ⚠️ 常见错误

### ModuleNotFoundError: No module named 'app'

**错误原因**: 直接运行 `python app/main.py` 会导致 Python 无法识别 `app` 包。

**正确方式**: 
- ✅ 在项目根目录使用 `python run.py`
- ✅ 或使用 `uvicorn app.main:app`
- ❌ 不要使用 `python app/main.py`

## 📍 访问地址

服务启动后，访问：

- **Swagger UI 文档**: http://localhost:8000/docs
- **ReDoc 文档**: http://localhost:8000/redoc
- **健康检查**: http://localhost:8000/health

## 🛑 停止服务

如果服务在后台运行：

```bash
# 查找进程
ps aux | grep uvicorn

# 停止进程
kill <PID>

# 或使用 pkill
pkill -f "uvicorn app.main:app"
```

如果服务在前台运行，按 `Ctrl+C` 停止。

## 🔧 开发模式

启用自动重载（代码修改后自动重启）：

```bash
uvicorn app.main:app --reload
```

## 📝 日志

服务日志会实时显示在控制台。如需保存日志：

```bash
uvicorn app.main:app --log-config logging.conf > api.log 2>&1
```
