# uv 环境指南

项目使用 uv 管理 Python 3.10 和独立的 `.venv`。无需激活 Conda 或手动激活虚拟环境；原有 Conda 环境不会被删除。

## 安装和同步

```bash
# macOS
brew install uv ffmpeg-full
# 在 .env 中设置：FFMPEG_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
# Intel Mac 通常使用 /usr/local/opt/ffmpeg-full/bin/ffmpeg；以 brew --prefix ffmpeg-full 为准。

# Linux：安装 uv，FFmpeg 另用系统包管理器安装
curl -LsSf https://astral.sh/uv/install.sh | sh

# 在项目根目录安装锁定的依赖（默认包含测试依赖）
uv sync --locked
uv run --locked python --version
```

uv 优先使用已有 Python 3.10，没有时会自动下载。FFmpeg 是系统依赖，不由 uv 安装。带字幕导出要求 FFmpeg 带 libass/subtitles 滤镜，可用 `$FFMPEG_PATH -filters` 检查；仅安装 libass 库不会给已有 FFmpeg 二进制增加滤镜。

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
uv run --locked pytest -v

# 查看依赖
uv tree
```

自动测试使用临时存储，每个 API 测试有独立数据库并运行应用启动/关闭流程，不访问真实任务数据。空文件上传返回 HTTP 400。

`test_api.py` 是手动端到端脚本，不作为 pytest 用例收集；运行它需要先启动后端并提供音频文件：`uv run --locked python test_api.py test_audio.mp3`。

## 编辑与长任务

- 编辑后点击“保存”；导出前也会保存，失败时不会继续导出。刷新页面读取已保存 EDL。刷新、关闭页面或点击工具栏返回时提示未保存修改；浏览器的 SPA 后退暂不拦截。
- 新导出状态与输出路径存入数据库，重启后仍可查询、下载已完成的文件；历史内存导出记录无法恢复。
- 单实例启动时把未完成的转写和导出标为失败，不自动继续执行。首页失败转写任务可重试（使用当前模型配置）；失败导出可从编辑器重新导出。
- 清理只删除未被数据库引用、且不属于活动导出的过期文件；引用文件暂时持续保留，需留意磁盘容量。清理不递归删除目录。
- 不要同时运行多个后端实例/worker：当前启动恢复没有分布式任务租约。
- AVI 使用无延迟的 PCM 音轨（文件通常较大）。启用字幕时 MP4/MOV/AVI 都使用硬字幕，应用字体、颜色、描边和位置；导出后不可关闭字幕。
- 所有带字幕导出都需要 FFmpeg 的 libass/subtitles 滤镜及所选字体，字体缺失会回退，浏览器与 FFmpeg 不保证逐像素一致。

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
