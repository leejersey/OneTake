# Conda 环境使用指南

## 环境信息

- **环境名称**: `onetake`
- **Python 版本**: 3.10.19
- **创建时间**: 2026-01-18

## 已安装的核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| faster-whisper | 1.2.1 | ASR 引擎（比原生 Whisper 快 4-10 倍） |
| torch | 2.9.1 | PyTorch 深度学习框架 |
| torchaudio | 2.9.1 | 音频处理 |
| numpy | 2.2.6 | 数值计算 |
| pydub | 0.25.1 | 音频文件处理 |
| ctranslate2 | 4.6.3 | Whisper 模型优化推理引擎 |

## 激活环境

每次使用项目前，需要先激活 conda 环境：

```bash
# 激活环境
conda activate onetake

# 验证环境
python --version  # 应该显示 Python 3.10.19
```

## 运行项目

```bash
# 1. 激活环境
conda activate onetake

# 2. 进入项目目录
cd /Users/lizexi/Documents/AI/agentPy

# 3. 运行 ASR 演示脚本
python asr_demo.py --input your_audio.mp3 --output result.json --pretty
```

## 常用命令

```bash
# 查看环境中已安装的包
conda activate onetake
pip list

# 查看核心依赖
pip list | grep -E '(faster-whisper|torch|numpy)'

# 查看帮助信息
python asr_demo.py --help

# 退出环境
conda deactivate
```

## 更新依赖

如果需要更新项目依赖：

```bash
conda activate onetake
pip install -r requirements.txt --upgrade
```

## 删除环境

如果需要重新创建环境：

```bash
# 退出环境
conda deactivate

# 删除环境
conda env remove -n onetake

# 重新创建
conda create -n onetake python=3.10 -y
conda activate onetake
pip install -r requirements.txt
```

## 环境导出

导出环境配置以便在其他机器上复现：

```bash
# 导出 conda 环境
conda activate onetake
conda env export > environment.yml

# 在其他机器上恢复
conda env create -f environment.yml
```

## 故障排查

### 问题 1: 环境激活失败

**症状**:
```
CommandNotFoundError: Your shell has not been properly configured to use 'conda activate'
```

**解决方案**:
```bash
# 初始化 conda
conda init zsh  # 如果使用 bash，则改为 conda init bash

# 重启终端或执行
source ~/.zshrc  # 或 source ~/.bashrc
```

### 问题 2: 包版本冲突

**解决方案**:
```bash
# 删除并重新创建环境
conda deactivate
conda env remove -n onetake
conda create -n onetake python=3.10 -y
conda activate onetake
pip install -r requirements.txt
```

### 问题 3: GPU 支持问题

**检查 GPU 可用性**:
```bash
conda activate onetake
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

如果显示 `False`，说明没有 GPU 或未正确安装 CUDA 版本的 PyTorch。MacBook M1/M2 芯片使用 MPS（Metal Performance Shaders）作为加速后端，无需额外配置。

## 下一步

环境已准备就绪！您可以：

1. **生成测试音频**（可选）:
   ```bash
   conda activate onetake
   pip install edge-tts
   python generate_test_audio.py --output test.mp3
   ```

2. **运行 ASR 演示**:
   ```bash
   conda activate onetake
   python asr_demo.py --input test.mp3 --output result.json --pretty
   ```

3. **查看结果**:
   ```bash
   cat result.json | python -m json.tool | head -50
   ```

---

*环境配置完成时间: 2026-01-18 22:33*
