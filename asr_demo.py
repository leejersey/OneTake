#!/usr/bin/env python3
"""
One Take 视频自动剪辑系统 - ASR 核心演示脚本

功能：
1. 使用 faster-whisper 进行音频转写
2. 提取字级（word-level）时间戳
3. 检测静音段落
4. 识别语气词/废话
5. 生成 Edit Decision List (EDL) JSON

作者: Gemini
日期: 2026-01-18
"""

import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import warnings
import numpy as np

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("❌ 错误: 未安装 faster-whisper")
    print("请运行: pip install faster-whisper")
    exit(1)


class NumpyEncoder(json.JSONEncoder):
    """自定义 JSON 编码器，处理 numpy 类型"""
    def default(self, obj):
        # 使用 np.floating 和 np.integer 来兼容 NumPy 2.0
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


@dataclass
class Word:
    """单个词的数据结构"""
    word: str
    start: float
    end: float
    confidence: float
    type: str = "normal"  # normal, filler, silence
    auto_delete: bool = False


@dataclass
class SilenceSegment:
    """静音段的数据结构"""
    start: float
    end: float
    duration: float
    auto_delete: bool = False


@dataclass
class TranscriptResult:
    """完整转写结果"""
    original_audio: str
    duration: float
    transcript: str
    words: List[Dict[str, Any]]
    silence_segments: List[Dict[str, Any]]
    statistics: Dict[str, Any]


class FasterWhisperASR:
    """Faster-Whisper ASR 引擎封装"""
    
    # 中文常见语气词词库
    CHINESE_FILLERS = {
        "呃", "嗯", "啊", "哦", "唉", "诶", "嘿",
        "那个", "这个", "就是", "然后",
        "就是说", "怎么说呢", "你知道吗",
        "对吧", "是吧", "对不对"
    }
    
    # 英文常见语气词
    ENGLISH_FILLERS = {
        "um", "uh", "er", "ah", "like", "you know", 
        "i mean", "sort of", "kind of"
    }
    
    def __init__(
        self, 
        model_size: str = "base",
        device: str = "auto",
        compute_type: str = "float16"
    ):
        """
        初始化 ASR 引擎
        
        Args:
            model_size: 模型大小 (tiny, base, small, medium, large-v2, large-v3)
            device: 计算设备 (cpu, cuda, auto)
            compute_type: 计算精度 (float16, int8, int8_float16)
        """
        print(f"🚀 正在加载 Whisper 模型: {model_size}")
        
        # 自动选择设备
        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
                if device == "cpu":
                    compute_type = "int8"  # CPU 模式使用 int8
            except ImportError:
                device = "cpu"
                compute_type = "int8"
        
        print(f"📱 使用设备: {device}, 计算类型: {compute_type}")
        
        try:
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type
            )
        except Exception as e:
            print(f"⚠️  模型加载失败，尝试使用 CPU 模式...")
            self.model = WhisperModel(
                model_size, 
                device="cpu", 
                compute_type="int8"
            )
        
        print("✅ 模型加载完成")
    
    def transcribe(
        self, 
        audio_path: str,
        language: Optional[str] = None,
        beam_size: int = 5
    ) -> List[Word]:
        """
        转写音频并提取字级时间戳
        
        Args:
            audio_path: 音频文件路径
            language: 语言代码 (zh, en 等)，None 则自动检测
            beam_size: Beam search 大小，越大越准确但越慢
        
        Returns:
            Word 对象列表
        """
        audio_path = str(Path(audio_path).resolve())
        print(f"\n🎤 开始转写音频: {audio_path}")
        
        if language:
            print(f"🌐 指定语言: {language}")
        else:
            print("🌐 自动检测语言...")
        
        # 执行转写，关键：word_timestamps=True 开启字级时间戳
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=beam_size,
            word_timestamps=True,  # 🔑 关键参数
            vad_filter=True,  # 启用 VAD 过滤
            vad_parameters=dict(
                min_silence_duration_ms=500  # 最小静音时长
            )
        )
        
        detected_language = info.language
        print(f"✅ 检测到语言: {detected_language}")
        print(f"📊 语言概率: {info.language_probability:.2%}")
        
        # 提取所有词及其时间戳
        words = []
        for segment in segments:
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    words.append(Word(
                        word=word.word.strip(),
                        start=word.start,
                        end=word.end,
                        confidence=word.probability
                    ))
        
        print(f"✅ 转写完成，共 {len(words)} 个词")
        return words, info.duration


class SilenceDetector:
    """静音段检测器"""
    
    def __init__(self, threshold: float = 0.5):
        """
        初始化静音检测器
        
        Args:
            threshold: 静音阈值（秒），超过此值的间隔被视为静音
        """
        self.threshold = threshold
    
    def detect(self, words: List[Word]) -> List[SilenceSegment]:
        """
        检测词间距中的静音段
        
        Args:
            words: Word 对象列表
        
        Returns:
            SilenceSegment 对象列表
        """
        if not words:
            return []
        
        silences = []
        
        for i in range(len(words) - 1):
            gap = words[i + 1].start - words[i].end
            
            if gap > self.threshold:
                # 判断是否应该自动删除（超过 0.8s 的停顿建议删除）
                auto_delete = gap > 0.8
                
                silences.append(SilenceSegment(
                    start=words[i].end,
                    end=words[i + 1].start,
                    duration=gap,
                    auto_delete=auto_delete
                ))
        
        print(f"🔇 检测到 {len(silences)} 个静音段 (阈值: {self.threshold}s)")
        return silences


class FillerDetector:
    """语气词/废话检测器"""
    
    def __init__(self, custom_fillers: Optional[set] = None):
        """
        初始化语气词检测器
        
        Args:
            custom_fillers: 自定义语气词集合
        """
        self.fillers = FasterWhisperASR.CHINESE_FILLERS.union(
            FasterWhisperASR.ENGLISH_FILLERS
        )
        
        if custom_fillers:
            self.fillers.update(custom_fillers)
    
    def detect(self, words: List[Word]) -> List[Word]:
        """
        标记语气词
        
        Args:
            words: Word 对象列表
        
        Returns:
            标记后的 Word 对象列表
        """
        filler_count = 0
        
        for word in words:
            # 去除标点符号后比较
            clean_word = word.word.strip().lower().replace(",", "").replace(".", "")
            
            if clean_word in self.fillers:
                word.type = "filler"
                word.auto_delete = True
                filler_count += 1
        
        print(f"💬 检测到 {filler_count} 个语气词/废话")
        return words


class EDLGenerator:
    """Edit Decision List 生成器"""
    
    @staticmethod
    def generate(
        audio_path: str,
        duration: float,
        words: List[Word],
        silences: List[SilenceSegment]
    ) -> TranscriptResult:
        """
        生成完整的 EDL JSON
        
        Args:
            audio_path: 音频文件路径
            duration: 音频总时长
            words: Word 对象列表
            silences: SilenceSegment 对象列表
        
        Returns:
            TranscriptResult 对象
        """
        # 生成完整转写文本
        transcript = " ".join([w.word for w in words])
        
        # 统计信息
        filler_count = sum(1 for w in words if w.type == "filler")
        silence_count = len(silences)
        suggested_cuts = filler_count + sum(1 for s in silences if s.auto_delete)
        
        # 计算预估最终时长（删除建议删除的部分）
        deleted_duration = sum(
            w.end - w.start for w in words if w.auto_delete
        ) + sum(
            s.duration for s in silences if s.auto_delete
        )
        estimated_final_duration = duration - deleted_duration
        
        statistics = {
            "total_words": len(words),
            "filler_count": filler_count,
            "silence_count": silence_count,
            "suggested_cuts": suggested_cuts,
            "original_duration": round(duration, 2),
            "estimated_final_duration": round(estimated_final_duration, 2),
            "time_saved": round(deleted_duration, 2),
            "compression_ratio": round(estimated_final_duration / duration * 100, 1)
        }
        
        return TranscriptResult(
            original_audio=str(Path(audio_path).name),
            duration=duration,
            transcript=transcript,
            words=[asdict(w) for w in words],
            silence_segments=[asdict(s) for s in silences],
            statistics=statistics
        )


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="One Take 视频自动剪辑 - ASR 核心演示",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 基础使用
  python asr_demo.py --input audio.mp3 --output result.json
  
  # 指定中文并使用更大的模型
  python asr_demo.py --input audio.mp3 --language zh --model small
  
  # 调整静音阈值
  python asr_demo.py --input audio.mp3 --silence-threshold 0.8
        """
    )
    
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入音频文件路径"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="output.json",
        help="输出 JSON 文件路径 (默认: output.json)"
    )
    
    parser.add_argument(
        "--model", "-m",
        default="base",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="Whisper 模型大小 (默认: base)"
    )
    
    parser.add_argument(
        "--language", "-l",
        default=None,
        help="音频语言代码，如 zh, en (默认: 自动检测)"
    )
    
    parser.add_argument(
        "--silence-threshold", "-s",
        type=float,
        default=0.5,
        help="静音检测阈值（秒） (默认: 0.5)"
    )
    
    parser.add_argument(
        "--device",
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="计算设备 (默认: auto)"
    )
    
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="格式化 JSON 输出（更易读）"
    )
    
    args = parser.parse_args()
    
    # 验证输入文件
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ 错误: 找不到文件 {args.input}")
        return 1
    
    print("=" * 70)
    print("🎬 One Take 视频自动剪辑系统 - ASR 核心演示")
    print("=" * 70)
    
    try:
        # 1. 初始化 ASR 引擎
        asr = FasterWhisperASR(
            model_size=args.model,
            device=args.device
        )
        
        # 2. 转写音频
        words, duration = asr.transcribe(
            args.input,
            language=args.language
        )
        
        if not words:
            print("⚠️  警告: 未检测到任何语音内容")
            return 1
        
        # 3. 检测静音
        silence_detector = SilenceDetector(threshold=args.silence_threshold)
        silences = silence_detector.detect(words)
        
        # 4. 检测语气词
        filler_detector = FillerDetector()
        words = filler_detector.detect(words)
        
        # 5. 生成 EDL
        print("\n📋 生成 Edit Decision List...")
        result = EDLGenerator.generate(
            args.input,
            duration,
            words,
            silences
        )
        
        # 6. 保存 JSON
        output_path = Path(args.output)
        with output_path.open("w", encoding="utf-8") as f:
            if args.pretty:
                json.dump(asdict(result), f, ensure_ascii=False, indent=2, cls=NumpyEncoder)
            else:
                json.dump(asdict(result), f, ensure_ascii=False, cls=NumpyEncoder)
        
        print(f"✅ 结果已保存到: {output_path.resolve()}")
        
        # 7. 输出统计信息
        print("\n" + "=" * 70)
        print("📊 处理统计")
        print("=" * 70)
        stats = result.statistics
        print(f"总词数:       {stats['total_words']}")
        print(f"语气词数:     {stats['filler_count']}")
        print(f"静音段数:     {stats['silence_count']}")
        print(f"建议剪切数:   {stats['suggested_cuts']}")
        print(f"原始时长:     {stats['original_duration']:.2f}s")
        print(f"预估时长:     {stats['estimated_final_duration']:.2f}s")
        print(f"节省时间:     {stats['time_saved']:.2f}s")
        print(f"压缩率:       {stats['compression_ratio']:.1f}%")
        print("=" * 70)
        
        print("\n✨ 处理完成！")
        print(f"\n💡 提示: 使用 'cat {output_path} | python -m json.tool' 查看格式化的 JSON")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
        return 130
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
