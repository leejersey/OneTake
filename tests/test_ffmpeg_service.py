"""
FFmpeg 服务单元测试
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock


class TestExtractKeepSegments:
    """测试 extract_keep_segments 方法"""
    
    def test_empty_edl(self):
        """空 EDL 返回空列表"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        result = service.extract_keep_segments({})
        assert result == []
    
    def test_all_words_kept(self):
        """所有词都保留"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        edl = {
            'words': [
                {'word': '你好', 'start': 0.0, 'end': 0.5, 'auto_delete': False},
                {'word': '世界', 'start': 0.5, 'end': 1.0, 'auto_delete': False},
            ]
        }
        
        result = service.extract_keep_segments(edl)
        assert result == [(0.0, 1.0)]
    
    def test_some_words_deleted(self):
        """部分词被删除"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        edl = {
            'words': [
                {'word': '你好', 'start': 0.0, 'end': 0.5, 'auto_delete': False},
                {'word': '呃', 'start': 0.5, 'end': 0.8, 'auto_delete': True},
                {'word': '世界', 'start': 1.0, 'end': 1.5, 'auto_delete': False},
            ]
        }
        
        result = service.extract_keep_segments(edl)
        assert result == [(0.0, 0.5), (1.0, 1.5)]
    
    def test_user_delete_respected(self):
        """用户手动删除生效"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        edl = {
            'words': [
                {'word': '你好', 'start': 0.0, 'end': 0.5, 'auto_delete': False, 'user_delete': True},
                {'word': '世界', 'start': 0.5, 'end': 1.0, 'auto_delete': False},
            ]
        }
        
        result = service.extract_keep_segments(edl)
        assert result == [(0.5, 1.0)]


class TestGetCodecArgs:
    """测试编码参数"""
    
    def test_high_quality(self):
        """高质量编码参数"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        args = service._get_codec_args('high')
        assert '-crf' in args
        assert '18' in args
    
    def test_medium_quality(self):
        """中等质量编码参数"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        args = service._get_codec_args('medium')
        assert '23' in args
    
    def test_low_quality(self):
        """低质量编码参数"""
        from app.services.ffmpeg_service import FFmpegService
        
        with patch.object(FFmpegService, '_check_ffmpeg'):
            service = FFmpegService()
        
        args = service._get_codec_args('low')
        assert '28' in args
