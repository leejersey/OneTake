"""
One Take API - ASR 服务封装
"""

import sys
from pathlib import Path
from typing import Optional, Dict

# 添加项目根目录到 Python 路径，以便导入 asr_demo 模块
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from asr_demo import (
    FasterWhisperASR,
    SilenceDetector,
    FillerDetector,
    EDLGenerator,
    NumpyEncoder
)


class ASRService:
    """ASR 服务封装类"""
    
    def __init__(
        self,
        model_size: str = "base",
        device: str = "auto",
        silence_threshold: float = 0.5
    ):
        """
        初始化 ASR 服务
        
        Args:
            model_size: Whisper 模型大小
            device: 计算设备
            silence_threshold: 静音检测阈值
        """
        self.asr = FasterWhisperASR(model_size=model_size, device=device)
        self.silence_detector = SilenceDetector(threshold=silence_threshold)
        self.filler_detector = FillerDetector()
    
    def process(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> Dict:
        """
        处理音频文件，生成 EDL
        
        Args:
            audio_path: 音频文件路径
            language: 语言代码
        
        Returns:
            EDL 字典
        """
        # 1. 转写音频
        words, duration = self.asr.transcribe(audio_path, language=language)
        
        if not words:
            raise ValueError("未检测到任何语音内容")
        
        # 2. 检测静音
        silences = self.silence_detector.detect(words)
        
        # 3. 检测语气词
        words = self.filler_detector.detect(words)
        
        # 4. 生成 EDL
        result = EDLGenerator.generate(
            audio_path,
            duration,
            words,
            silences
        )
        
        # 转换为字典
        from dataclasses import asdict
        return asdict(result)
