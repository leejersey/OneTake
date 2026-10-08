# uv 环境指南

项目使用 uv 管理 Python 3.10 和独立的 `.venv`。无需激活 Conda 或手动激活虚拟环境；原有 Conda 环境不会被删除。

## 安装和同步

```bash
# macOS
brew install uv ffmpeg

# Linux：安装 uv，FFmpeg 另用系统包管理器安装
curl -LsSf https://astral.sh/uv/install.sh | sh

# 在项目根目录安装锁定的依赖（默认包含测试依赖）
uv sync --locked
uv run --locked python --version
```

uv 优先使用已有 Python 3.10，没有时会自动下载。FFmpeg 是系统依赖，不由 uv 安装。

## 常用命令

```bash
# 启动后端
uv run --locked python run.py

# 热重载
./start_api.sh

# 同时启动前后端（前端先 cd frontend && npm ci）
./start_all.sh

# 转写
uv run --locked python asr_demo.py --input your_audio.mp3 --output result.json --pretty

# 可选语音生成工具，不写入项目运行依赖
uv run --locked --with edge-tts python generate_test_audio.py --output test.mp3

# 测试
uv run --locked pytest tests/ -v

# 查看依赖
uv tree
```

已知测试问题仍保留：根目录 `test_api.py` 有缩进错误；API 测试未初始化数据库；空文件上传未拒绝。环境迁移不修复这些业务和测试问题。

## 修改依赖

`pyproject.toml` 是依赖声明的唯一来源，`uv.lock` 固定版本，二者均应提交。

```bash
uv add package-name
uv add --dev package-name
uv lock --check
uv sync --locked

# 更新 requirements.txt 兼容导出；不要手动编辑它
uv export --locked --no-hashes --output-file requirements.txt
```

仅升级需要的包，避免无关升级：`uv lock --upgrade-package package-name`。

## Docker 与 GPU

Docker 使用 uv 0.10.11 和同一锁文件，`uv sync --locked --no-dev` 不安装测试工具。
Linux 上默认 PyTorch 包可能包含较大的 CUDA 依赖，首次同步需要较长时间。
GPU 使用还依赖匹配的 NVIDIA 驱动、CUDA/cuDNN 与 CTranslate2；切换 PyTorch 索引前应明确硬件版本，并在 uv 中配置、重新锁定，不能用外部 pip 覆盖后继续声称环境可复现。
