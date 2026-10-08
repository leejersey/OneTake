# One Take API - 后端 Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app/ ./app/
COPY run.py asr_demo.py ./
COPY .env.example .env

# 创建存储目录
RUN mkdir -p storage/uploads storage/results storage/exports storage/logs

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "run.py"]
