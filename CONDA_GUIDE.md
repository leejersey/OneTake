# 环境指南已迁移

项目已改用 **uv + Python 3.10 + `.venv`**，见 [uv 环境指南](UV_GUIDE.md)。

```bash
uv sync --locked
uv run --locked python run.py
```

无需激活 Conda；现有 Conda 环境保留，不会自动删除。
