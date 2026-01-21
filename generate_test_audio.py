#!/usr/bin/env python3
"""
测试音频生成脚本

使用文本转语音 (TTS) 生成包含语气词和停顿的测试音频
用于验证 ASR 系统的时间戳精度

依赖: pip install edge-tts
"""

import asyncio
import argparse
from pathlib import Path


async def generate_test_audio(output_file: str = "test_audio.mp3", language: str = "zh"):
    """
    生成测试音频
    
    Args:
        output_file: 输出文件路径
        language: 语言 (zh, en)
    """
    try:
        import edge_tts
    except ImportError:
        print("❌ 错误: 未安装 edge-tts")
        print("请运行: pip install edge-tts")
        return False
    
    # 测试文本（包含语气词和停顿）
    if language == "zh":
        text = """
        大家好，我是 Gemini。
        今天呢，我要给大家介绍一个非常有意思的项目。
        这个项目呃，主要是用来做视频自动剪辑的。
        就是说，你可以像编辑文档一样编辑视频。
        非常方便，对吧？
        那个，我们来看一下具体的技术方案。
        首先呢，我们使用了 Whisper 进行语音识别。
        然后，嗯，通过字级时间戳来实现精确对齐。
        最后，就可以实现自动剪辑了。
        好的，以上就是今天的分享，谢谢大家！
        """
        voice = "zh-CN-XiaoxiaoNeural"  # 中文女声
    else:
        text = """
        Hello everyone, I'm Gemini.
        Um, today I want to introduce a very interesting project.
        This project, uh, is mainly used for automatic video editing.
        You know, you can edit videos like editing documents.
        Very convenient, right?
        So, let's take a look at the technical solution.
        First, um, we use Whisper for speech recognition.
        Then, uh, through word-level timestamps to achieve precise alignment.
        Finally, automatic editing can be achieved.
        Okay, that's all for today's sharing, thank you!
        """
        voice = "en-US-JennyNeural"  # 英文女声
    
    print(f"🎙️  正在生成测试音频...")
    print(f"📝 文本长度: {len(text)} 字符")
    print(f"🔊 使用语音: {voice}")
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    
    output_path = Path(output_file).resolve()
    print(f"✅ 音频已生成: {output_path}")
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description="生成测试音频文件"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="test_audio.mp3",
        help="输出文件路径 (默认: test_audio.mp3)"
    )
    
    parser.add_argument(
        "--language", "-l",
        default="zh",
        choices=["zh", "en"],
        help="语言 (默认: zh)"
    )
    
    args = parser.parse_args()
    
    success = asyncio.run(generate_test_audio(args.output, args.language))
    
    if success:
        print("\n💡 下一步:")
        print(f"   python asr_demo.py --input {args.output} --output result.json --pretty")
        return 0
    else:
        return 1


if __name__ == "__main__":
    exit(main())
