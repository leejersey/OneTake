"""
One Take API - 字幕服务
生成 SRT 格式字幕文件
"""

from typing import List, Dict
from pathlib import Path


class SubtitleService:
    """字幕生成服务"""
    
    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """
        将秒数转换为 SRT 时间戳格式
        
        Args:
            seconds: 秒数（浮点）
        
        Returns:
            SRT 格式时间戳 (HH:MM:SS,mmm)
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    @staticmethod
    def split_text_by_width(text: str, max_chars: int) -> List[str]:
        """
        根据最大字符数分割文本为多行
        
        Args:
            text: 待分割文本
            max_chars: 每行最大字符数
        
        Returns:
            分割后的文本行列表
        """
        if len(text) <= max_chars:
            return [text]
        
        lines = []
        current_line = ""
        words = text.split()
        
        for word in words:
            if len(current_line) + len(word) + 1 <= max_chars:
                current_line += word + " "
            else:
                if current_line:
                    lines.append(current_line.strip())
                current_line = word + " "
        
        if current_line:
            lines.append(current_line.strip())
        
        return lines
    
    @staticmethod
    def group_sentences(words: List[Dict]) -> List[List[Dict]]:
        """Same punctuation/gap/length boundaries as the editor preview."""
        groups, current = [], []
        for i, word in enumerate(words):
            current.append(word)
            following = words[i + 1] if i + 1 < len(words) else None
            if (word.get('word', '').endswith(('。', '！', '？', '.', '!', '?', '，', ','))
                    or following is None or following['start'] - word['end'] > 0.45
                    or len(current) >= 18):
                groups.append(current)
                current = []
        return groups

    @staticmethod
    def generate_ass(words, output_path, segments, config, width, height):
        """Styled captions on a logical 216px-high canvas, scaled by libass."""
        from app.models import SubtitleConfig
        style = SubtitleConfig(**config)
        alignment = {'top': 8, 'center': 5, 'bottom': 2}[style.position]
        margin = 16 if style.position == 'top' else 20

        def color(value):
            return '&H00' + value[5:7] + value[3:5] + value[1:3]

        def timestamp(seconds):
            ticks = round(seconds * 100)
            return f'{ticks // 360000}:{ticks // 6000 % 60:02}:{ticks // 100 % 60:02}.{ticks % 100:02}'

        events = []
        for group in SubtitleService.group_sentences(words):
            active = [word for word in group if not (word.get('auto_delete') or word.get('user_delete'))]
            if active:
                events.append({'word': ''.join(word['word'] for word in active),
                               'start': active[0]['start'], 'end': active[-1]['end']})
        primary, outline = color(style.color), color(style.outline_color)
        lines = [
            '[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {round(216 * width / height)}',
            'PlayResY: 216', 'WrapStyle: 1', 'ScaledBorderAndShadow: yes', '',
            '[V4+ Styles]',
            'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
            f'Style: Default,{style.font_name},{style.font_size or 20},{primary},{primary},{outline},&H00000000,-1,0,0,0,100,100,0,0,1,{style.outline_width},0,{alignment},12,12,{margin},1', '',
            '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ]
        for event in SubtitleService.remap_words(events, segments):
            # Prevent transcript text from being interpreted as ASS override tags.
            text = event['word'].replace('\\', '＼').replace('{', '｛').replace('}', '｝').replace('\n', r'\N').replace('\r', '')
            lines.append(f"Dialogue: 0,{timestamp(event['start'])},{timestamp(event['end'])},Default,,0,0,0,,{text}")
        Path(output_path).write_text('\n'.join(lines) + '\n', encoding='utf-8')
        return output_path

    @staticmethod
    def remap_words(words: List[Dict], segments: List[tuple]) -> List[Dict]:
        """将原视频词时间映射到保留片段拼接后的时间轴，不修改 EDL。"""
        mapped = []
        for word in words:
            if word.get('auto_delete') or word.get('user_delete'):
                continue
            offset = 0
            spans = []
            for start, end in segments:
                overlap_start = max(word['start'], start)
                overlap_end = min(word['end'], end)
                if overlap_start < overlap_end:
                    spans.append((offset + overlap_start - start,
                                  offset + overlap_end - start))
                offset += end - start
            if spans:
                mapped.append({**word, 'start': spans[0][0], 'end': spans[-1][1]})
        return mapped

    @staticmethod
    def generate_srt(
        words: List[Dict],
        output_path: str,
        max_chars_per_line: int = 40,
        group_duration: float = 3.0
    ) -> str:
        """
        从词列表生成 SRT 字幕文件
        
        Args:
            words: EDL 词列表
            output_path: 输出 SRT 文件路径
            max_chars_per_line: 每行最大字符数（横屏 40，竖屏 15）
            group_duration: 字幕分组时长（秒）
        
        Returns:
            生成的 SRT 文件路径
        """
        # 过滤已删除的词
        active_words = [w for w in words if not w.get('user_delete') and not w.get('auto_delete')]
        
        if not active_words:
            # 空字幕
            Path(output_path).write_text("", encoding='utf-8')
            return output_path
        
        subtitles = []
        current_group = []
        current_start = None
        current_end = None
        
        for word in active_words:
            word_text = word.get('word', '')
            word_start = word.get('start', 0)
            word_end = word.get('end', 0)
            
            if current_start is None:
                current_start = word_start
            
            current_group.append(word_text)
            current_end = word_end
            
            # 检查是否需要分组（达到时长或字符数）
            group_text = ' '.join(current_group)
            duration = current_end - current_start
            
            if duration >= group_duration or len(group_text) >= max_chars_per_line:
                # 生成字幕条目
                lines = SubtitleService.split_text_by_width(group_text, max_chars_per_line)
                subtitle_text = '\n'.join(lines)
                
                subtitles.append({
                    'start': current_start,
                    'end': current_end,
                    'text': subtitle_text
                })
                
                # 重置
                current_group = []
                current_start = None
                current_end = None
        
        # 处理剩余的词
        if current_group:
            group_text = ' '.join(current_group)
            lines = SubtitleService.split_text_by_width(group_text, max_chars_per_line)
            subtitle_text = '\n'.join(lines)
            
            subtitles.append({
                'start': current_start,
                'end': current_end,
                'text': subtitle_text
            })
        
        # 生成 SRT 内容
        srt_content = []
        for i, subtitle in enumerate(subtitles, 1):
            start_time = SubtitleService.format_timestamp(subtitle['start'])
            end_time = SubtitleService.format_timestamp(subtitle['end'])
            
            srt_content.append(f"{i}")
            srt_content.append(f"{start_time} --> {end_time}")
            srt_content.append(subtitle['text'])
            srt_content.append("")  # 空行分隔
        
        # 写入文件
        srt_text = '\n'.join(srt_content)
        Path(output_path).write_text(srt_text, encoding='utf-8')
        
        return output_path
    
    @staticmethod
    def detect_aspect_ratio(video_path: str) -> tuple:
        """
        检测视频宽高比
        
        Args:
            video_path: 视频文件路径
        
        Returns:
            (width, height, aspect_ratio, orientation)
            orientation: 'horizontal' 或 'vertical'
        """
        import json
        import subprocess
        from app.config import settings
        probe = subprocess.run([
            str(Path(settings.ffmpeg_path).with_name('ffprobe')), '-v', 'error',
            '-show_streams', '-of', 'json', video_path,
        ], capture_output=True, text=True, check=True, timeout=30)
        stream = next(s for s in json.loads(probe.stdout)['streams'] if s['codec_type'] == 'video')
        width, height = int(stream['width']), int(stream['height'])
        aspect_ratio = width / height
        return width, height, aspect_ratio, 'horizontal' if aspect_ratio > 1 else 'vertical'
    
    @staticmethod
    def get_optimal_subtitle_params(video_path: str) -> Dict:
        """
        根据视频比例获取最优字幕参数
        
        Args:
            video_path: 视频文件路径
        
        Returns:
            字幕参数字典
        """
        width, height, aspect_ratio, orientation = SubtitleService.detect_aspect_ratio(video_path)
        
        if orientation == 'vertical':  # 竖屏 9:16
            return {
                'font_size': int(height * 0.04),  # 4% 屏幕高度
                'max_chars_per_line': 15,
                'margin_v': int(height * 0.1),  # 底部边距
            }
        else:  # 横屏 16:9
            return {
                'font_size': int(height * 0.05),  # 5% 屏幕高度
                'max_chars_per_line': 40,
                'margin_v': int(height * 0.08),
            }
