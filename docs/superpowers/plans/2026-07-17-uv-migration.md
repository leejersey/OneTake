# uv 环境迁移计划

**Goal:** 将 Python 环境管理迁移到 uv，保留 Python 3.10、现有运行依赖与业务行为，不删除 Conda 环境。

**Architecture:** pyproject.toml 定义依赖，uv.lock 锁定解析结果，.python-version 选择 3.10，uv 管理隔离 .venv。现有 requirements.txt 改为从锁文件导出的兼容文件。pytest/httpx 为开发依赖。启动脚本和 Docker 使用 uv，Docker 不安装开发依赖。

**Tech Stack:** uv 0.10.11、Python 3.10、现有 FastAPI/ASR/FFmpeg 服务。

- [x] 添加环境配置回归检查并确认迁移前失败。
- [x] 添加 pyproject.toml、.python-version，生成 uv.lock，uv sync 安装独立环境。
- [x] 更新 start_api.sh、start_all.sh、quickstart.sh、Dockerfile 与 Docker 上下文忽略规则。
- [x] 更新安装、启动、测试及示例文档，旧 Conda 指南保留跳转。
- [x] 运行 uv lock --check、uv sync --locked、目标测试；隔离启动后端检查真实 ASR 与导出；复核完整测试已知失败，验证 Docker 配置。

本轮不修复空文件上传、旧测试脚本缩进、测试数据库 fixture、AVI 字幕/音轨问题，也不自动提交 Git。

## 验证结果
- uv 0.10.11 创建项目 .venv，使用 Python 3.10.19；锁文件校验、重复同步和 requirements 兼容导出一致性检查通过。
- 保留原运行依赖声明；pytest/httpx 归入 dev，补充根目录 test_api.py 所用 requests 为 dev 依赖。
- 目标回归测试 25 项通过，bash -n 三个脚本通过。
- 初始化临时测试数据库后 tests/：35 passed、1 failed；失败仍为空文件上传返回 200。根目录 pytest 仍被 test_api.py:92 缩进错误阻断。
- uv 环境真实后端启动、健康检查、文档、视频上传、tiny CPU 转写（111 个词）、WebSocket、带字幕 MP4 导出/下载通过。3～4 秒片段输出长度 1.000000 秒。临时服务已停止，日志/样片位于 /tmp/agentpy-uv-check.lqglDp/。
- docker build --check . 通过，无警告；未执行完整后端镜像构建。首次下载 Torch 超过 240 秒超时，第二次同步完成。

