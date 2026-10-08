# 剪辑与部署修复计划

**Goal:** 修复审计项 1、5、6、7、2、3、4，不引入新依赖或无关功能。

**Architecture:** 保留现有 EDL 接口，统一从词和删除的静音计算保留区间；FFmpeg trim/atrim 后重置时间戳并 concat，字幕使用相同区间重映射。前端恢复词时清除两个删除标记，网络地址同源优先，显式 API 地址仍受支持。

**Tech Stack:** Python/pytest、FFmpeg、React/Vite、Node 内置测试、Docker/Nginx。

## 执行步骤
- [x] 添加并运行失败的 Python 回归测试：删除静音、0 秒字幕、字幕重映射、真实非关键帧剪辑（含无音轨输入）。
- [x] 修改 app/services/ffmpeg_service.py、app/services/subtitle_service.py、app/api/export.py；运行回归测试。
- [x] 添加前端最小回归检查并验证失败；修复 frontend/src/pages/Editor.jsx、frontend/src/api/client.js、frontend/src/pages/Home.jsx。
- [x] 修复 Dockerfile、.gitignore，保留 frontend/package-lock.json；补 frontend/nginx.conf 和 frontend/vite.config.js 的同源代理。
- [x] 验证 Python 单元测试、Node 回归检查、npm ci/build、diff；Docker 可用时验证镜像构建，否则明确报告未验证项。

## 验收标准与边界
- 3～3.5 秒片段输出约 0.5 秒（允许一帧及音频编码误差），多段按顺序连接，音画内容和时间对应。
- 静音仅在 auto_delete 或 user_delete 标记时删除，未标记的间隔仍保留。
- 恢复自动删除的词后可导出，单词与批量恢复都生效。
- 字幕从输出时间轴 0 秒开始，删除区间不产生字幕，输入词不被原地修改。
- 本地 Vite 与 Docker Nginx 均支持同源 HTTP/WebSocket；显式 API 基址、HTTPS 和非默认端口得到覆盖。
- 不改变任务持久化、字幕样式、认证或后台任务架构。本次不自动提交 Git。

## 验证结果
- Python 目标单元测试 22 项通过，含真实 FFmpeg 单段/多段、有/无音轨、非关键帧颜色及长度检查。
- Node 回归测试 9 项通过；npm ci、Vite 构建通过。
- 前端 Docker 在不含 node_modules、dist 或 .env 的干净上下文中构建通过；容器 Nginx 的 API、健康检查、下载、2 MiB 上传和 WebSocket Upgrade 代理检查通过（模拟后端）。
- 删除未使用且未进入原锁文件的 react-window，解决 npm ci 的 manifest/lock 不一致。
- 后端 Docker 构建在下载 454 MB Torch 依赖时超过 300 秒超时，未完成启动验证。
- 完整 pytest 收集被本机缺少 slowapi 阻断；前端 lint 仍有原有 7 错误、2 警告。未进行真实 Whisper 转写或完整浏览器端到端验证。
