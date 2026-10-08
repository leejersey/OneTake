"""
One Take API - FFmpeg 视频剪辑服务
"""

import subprocess
import json
import logging
import math
import shutil
from tempfile import TemporaryDirectory
from pathlib import Path
from typing import Dict, List, Tuple

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
        
        for silence in edl.get('silence_segments', []):
            if not (silence.get('auto_delete') or silence.get('user_delete')):
                continue
            cut_start, cut_end = float(silence['start']), float(silence['end'])
            if not (math.isfinite(cut_start) and math.isfinite(cut_end)
                    and 0 <= cut_start < cut_end):
                raise ValueError("无效的静音时间区间")
            remaining = []
            for start, end in segments:
                if cut_end <= start or cut_start >= end:
                    remaining.append((start, end))
                else:
                    if start < cut_start:
                        remaining.append((start, cut_start))
                    if cut_end < end:
                        remaining.append((cut_end, end))
            segments = remaining
        return segments
    
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
        
        previous_end = 0
        for start, end in segments:
            if not (isinstance(start, (int, float)) and isinstance(end, (int, float))
                    and math.isfinite(start) and math.isfinite(end)
                    and previous_end <= start < end):
                raise ValueError("无效的保留时间区间")
            previous_end = end

        ffprobe_path = str(Path(self.ffmpeg_path).with_name('ffprobe'))
        probe = subprocess.run(
            [ffprobe_path, '-v', 'error', '-show_streams', '-of', 'json', input_video],
            capture_output=True, text=True, timeout=30
        )
        if probe.returncode != 0:
            raise RuntimeError(f"FFprobe 失败: {probe.stderr}")
        streams = json.loads(probe.stdout)['streams']
        if not any(s['codec_type'] == 'video' for s in streams):
            raise ValueError("输入文件没有视频轨道")
        has_audio = any(s['codec_type'] == 'audio' for s in streams)

        filters = []
        inputs = []
        for i, (start, end) in enumerate(segments):
            filters.append(
                f"[0:v:0]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]"
            )
            inputs.append(f"[v{i}]")
            if has_audio:
                filters.append(
                    f"[0:a:0]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]"
                )
                inputs.append(f"[a{i}]")
        filters.append(
            f"{''.join(inputs)}concat=n={len(segments)}:v=1:a={int(has_audio)}"
            + ('[vout][aout]' if has_audio else '[vout]')
        )
        cmd = [self.ffmpeg_path, '-i', input_video,
               '-filter_complex', ';'.join(filters), '-map', '[vout]']
        if has_audio:
            cmd += ['-map', '[aout]']
        cmd += [*self._get_codec_args(quality, output_path.suffix), '-y', str(output_path)]
        logger.info(f"执行FFmpeg命令: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error(f"FFmpeg stderr: {result.stderr}")
            raise RuntimeError(f"FFmpeg 失败: {result.stderr}")
        logger.info(f"视频剪辑成功: {output_path}")
        return str(output_path)
    
    def _get_codec_args(self, quality: str, suffix: str = '.mp4') -> List[str]:
        preset, crf, bitrate = {
            'high': ('slow', '18', '192k'),
            'medium': ('medium', '23', '128k'),
            'low': ('fast', '28', '96k'),
        }.get(quality, ('fast', '28', '96k'))
        args = ['-c:v', 'libx264', '-preset', preset, '-crf', crf]
        # PCM avoids AAC priming/padding being represented as extra AVI duration.
        return args + (['-c:a', 'pcm_s16le'] if suffix.lower() == '.avi'
                       else ['-c:a', 'aac', '-b:a', bitrate])
    
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
        subtitle_config: Dict = None,
        quality: str = 'medium'
    ) -> str:
        """AVI burns captions with libass; MP4/MOV retain soft subtitles.

        subtitle_config remains reserved for styling, as in the soft-subtitle path.
        """
        executable = shutil.which(self.ffmpeg_path) or str(Path(self.ffmpeg_path).resolve())
        with TemporaryDirectory(prefix='onetake-subtitles-') as temporary:
            cmd = [executable, '-i', str(Path(input_video).resolve())]
            if output_path.suffix.lower() == '.avi':
                # A fixed filename avoids filter parsing problems with punctuation in paths.
                shutil.copyfile(subtitle_file, Path(temporary) / 'captions.srt')
                cmd += ['-vf', 'subtitles=captions.srt', *self._get_codec_args(quality, '.avi')]
            else:
                cmd += ['-i', str(Path(subtitle_file).resolve()), '-map', '0:v:0',
                        '-map', '0:a:0?', '-map', '1:0', '-c:v', 'copy', '-c:a', 'copy',
                        '-c:s', 'mov_text', '-metadata:s:s:0', 'language=chi']
            cmd += ['-y', str(output_path.resolve())]
            logger.info(f"字幕嵌入命令: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=temporary)
        
        if result.returncode != 0:
            logger.error(f"字幕嵌入失败: {result.stderr}")
            raise RuntimeError(f"字幕嵌入失败: {result.stderr}")
        
        logger.info(f"字幕嵌入成功: {output_path}")
        return str(output_path)
