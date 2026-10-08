# One Take 前端

基于 React + Vite 的视频编辑前端界面。

## 安装和运行

```bash
cd frontend
npm ci
npm run dev
```

访问 http://localhost:5173

## 配置

默认同源访问 API 和 WebSocket，无需创建 `.env`。开发时 Vite 将 `/api`、`/health` 和 `/ws` 代理到 `127.0.0.1:8000`；Docker 部署由 Nginx 代理到后端服务。

如果后端部署在独立地址，可在 `.env` 中显式设置（修改后需重新构建）：

```
VITE_API_BASE=https://api.example.com
```

HTTP API、媒体下载和 WebSocket 都使用这个基址。HTTPS 页面应连接 HTTPS 后端。

## 验证

```bash
npm test
npm run build
```

## 功能

- ✅ 文件上传
- ✅ ASR 转写状态轮询
- ✅ 逐字稿编辑（点击切换删除状态）
- ✅ 视频导出和下载
- ⏸️ 视频播放器集成
- ⏸️ 视频文本同步
- ⏸️ 波形图可视化

## 技术栈

- React 18
- Vite 7
- React Router
- Axios
