"""
One Take API - FFmpeg 视频剪辑服务
"""

import subprocess
import uuid
import logging
from pathlib import Path
from typing import Dict, List, Tuple
from app.config import settings

logger = logging.getLogger(__name__)


class FFmpegService:
    """FFmpeg 视频剪辑服务"""
    
    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        """
        初始化 FFmpeg 服务
        
        Args:
            ffmpeg_path: FFmpeg 可执行文件路径
        """
        self.ffmpeg_path = ffmpeg_path
        self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        """检查 FFmpeg 是否可用"""
        try:
            result = subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                raise RuntimeError("FFmpeg 不可用")
        except Exception as e:
            raise RuntimeError(f"FFmpeg 检查失败: {e}")
    
    def extract_keep_segments(self, edl: Dict) -> List[Tuple[float, float]]:
        """
        从 EDL 中提取需要保留的片段
        
        Args:
            edl: Edit Decision List
        
        Returns:
            [(start, end), ...] 保留片段列表
        """
        words = edl.get('words', [])
        if not words:
            return []
        
        segments = []
        current_start = None
        current_end = None
        
        for word in words:
            # 跳过被标记为删除的词(自动删除或用户手动删除)
            if word.get('auto_delete', False) or word.get('user_delete', False):
                if current_start is not None:
                    # 保存当前片段
                    segments.append((current_start, current_end))
                    current_start = None
                    current_end = None
                continue
            
            # 正常词
            if current_start is None:
                current_start = word['start']
            current_end = word['end']
        
        # 保存最后一个片段
        if current_start is not None and current_end is not None:
            segments.append((current_start, current_end))
        
        return segments
    
    def create_concat_file(self, input_video: str, segments: List[Tuple[float, float]], concat_file: Path) -> None:
        """
        创建 FFmpeg concat 文件
        
        Args:
            input_video: 输入视频路径
            segments: 保留片段列表
            concat_file: concat 文件路径
        """
        # 使用绝对路径,避免路径解析问题
        abs_input_video = str(Path(input_video).resolve())
        logger.info(f"创建concat文件: {concat_file}, 输入视频: {abs_input_video}, 片段数: {len(segments)}")
        
        with open(concat_file, 'w') as f:
            for start, end in segments:
                f.write(f"file '{abs_input_video}'\n")
                f.write(f"inpoint {start}\n")
                f.write(f"outpoint {end}\n")
        
        # 记录concat文件内容以便调试
        with open(concat_file, 'r') as f:
            logger.debug(f"Concat文件内容:\n{f.read()}")
    
    def clip_video(
        self,
        input_video: str,
        edl: Dict,
        output_path: Path,
        quality: str = "high"
    ) -> str:
        """
        根据 EDL 剪辑视频
        
        Args:
            input_video: 输入视频路径
            edl: Edit Decision List
            output_path: 输出视频路径
            quality: 质量设定 (low, medium, high)
        
        Returns:
            输出文件路径
        """
        # 提取保留片段
        segments = self.extract_keep_segments(edl)
        logger.info(f"提取到 {len(segments)} 个保留片段")
        
        if not segments:
            logger.error("没有可保留的片段")
            raise ValueError("没有可保留的片段")
        
        # 如果只有一个片段且是完整视频，直接复制
        if len(segments) == 1:
            start, end = segments[0]
            duration = edl.get('duration', 0)
            if start == 0 and abs(end - duration) < 0.1:
                import shutil
                shutil.copy2(input_video, output_path)
                return str(output_path)
        
        # 创建 concat 文件
        concat_file = output_path.parent / f"{uuid.uuid4()}_concat.txt"
        try:
            self.create_concat_file(input_video, segments, concat_file)
            
            # 设置编码参数
            codec_args = self._get_codec_args(quality)
            
            # 构建 FFmpeg 命令
            cmd = [
                self.ffmpeg_path,
                '-f', 'concat',
                '-safe', '0',
                '-i', str(concat_file),
                *codec_args,
                '-y',  # 覆盖输出文件
                str(output_path)
            ]
            
            # 记录FFmpeg命令
            logger.info(f"执行FFmpeg命令: {' '.join(cmd)}")
            
            # 执行 FFmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 分钟超时
            )
            
            if result.returncode != 0:
                logger.error(f"FFmpeg执行失败 (返回码: {result.returncode})")
                logger.error(f"FFmpeg stderr: {result.stderr}")
                logger.error(f"FFmpeg stdout: {result.stdout}")
                raise RuntimeError(f"FFmpeg 失败: {result.stderr}")
            
            logger.info(f"视频剪辑成功: {output_path}")
            
            return str(output_path)
        
        finally:
            # 清理 concat 文件
            if concat_file.exists():
                concat_file.unlink()
    
    def _get_codec_args(self, quality: str) -> List[str]:
        """
        获取编码参数
        
        Args:
            quality: 质量设定
        
        Returns:
            FFmpeg 参数列表
        """
        if quality == "high":
            return [
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '18',
                '-c:a', 'aac',
                '-b:a', '192k'
            ]
        elif quality == "medium":
            return [
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k'
            ]
        else:  # low
            return [
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '96k'
            ]
    
    def clip_video_simple(
        self,
        input_video: str,
        start_time: float,
        end_time: float,
        output_path: Path
    ) -> str:
        """
        简单的视频剪辑（单个片段）
        
        Args:
            input_video: 输入视频
            start_time: 开始时间（秒）
            end_time: 结束时间（秒）
            output_path: 输出路径
        
        Returns:
            输出文件路径
        """
        duration = end_time - start_time
        
        cmd = [
            self.ffmpeg_path,
            '-i', input_video,
            '-ss', str(start_time),
            '-t', str(duration),
            '-c', 'copy',  # Stream copy，快速
            '-y',
            str(output_path)
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg 失败: {result.stderr}")
        
        return str(output_path)
    
    def burn_subtitles(
        self,
        input_video: str,
        subtitle_file: str,
        output_path: Path,
        subtitle_config: Dict = None
    ) -> str:
        """
        将字幕嵌入到视频中（软字幕方式）
        
        由于 macOS FFmpeg 默认不支持 libass，使用软字幕嵌入
        
        Args:
            input_video: 输入视频路径
            subtitle_file: SRT 字幕文件路径
            output_path: 输出视频路径
            subtitle_config: 字幕配置（预留）
        
        Returns:
            输出文件路径
        """
        # 使用软字幕嵌入（mov_text 格式，兼容性好）
        cmd = [
            self.ffmpeg_path,
            '-i', input_video,
            '-i', subtitle_file,
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-c:s', 'mov_text',  # MP4 兼容的字幕格式
            '-metadata:s:s:0', 'language=chi',  # 设置字幕语言
            '-y',
            str(output_path)
        ]
        
        logger.info(f"字幕嵌入命令: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            logger.error(f"字幕嵌入失败: {result.stderr}")
            raise RuntimeError(f"字幕嵌入失败: {result.stderr}")
        
        logger.info(f"字幕嵌入成功: {output_path}")
        return str(output_path)
