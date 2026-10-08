"""Real AVI codec, duration and burned-in subtitle checks."""
import json
import subprocess
from pathlib import Path

import pytest

from app.config import settings
from app.services.ffmpeg_service import FFmpegService


def test_avi_subtitle_render_preserves_requested_quality(tmp_path, monkeypatch):
    from types import SimpleNamespace
    calls = []
    monkeypatch.setattr(FFmpegService, '_check_ffmpeg', lambda self: None)
    monkeypatch.setattr(subprocess, 'run', lambda cmd, **kwargs: (
        calls.append(cmd) or SimpleNamespace(returncode=0, stderr='')))
    srt = tmp_path / 'captions.srt'
    srt.write_text('1\n00:00:00,000 --> 00:00:01,000\ntest\n')
    FFmpegService().burn_subtitles('clip.avi', str(srt), tmp_path / 'final.avi', quality='high')
    assert calls[0][calls[0].index('-crf') + 1] == '18'
    assert calls[0][calls[0].index('-preset') + 1] == 'slow'


@pytest.mark.parametrize('subtitles', [False, True])
def test_avi_duration_and_subtitles(tmp_path, subtitles):
    service = FFmpegService(settings.ffmpeg_path)
    source = tmp_path / 'source.mp4'
    subprocess.run([service.ffmpeg_path, '-v', 'error', '-f', 'lavfi', '-i',
                    'color=black:s=320x180:r=25:d=4', '-f', 'lavfi', '-i',
                    'sine=frequency=440:duration=4', '-c:v', 'libx264', '-y', str(source)],
                   check=True, capture_output=True)
    output = tmp_path / 'clip.avi'
    service.clip_video(str(source), {'words': [{'start': 1, 'end': 2}]}, output, 'low')
    if subtitles:
        # Paths with punctuation must not become filter expressions.
        subtitle_dir = tmp_path / "captions' folder"
        subtitle_dir.mkdir()
        srt = subtitle_dir / 'caption.srt'
        srt.write_text('1\n00:00:00,000 --> 00:00:01,000\nVisible subtitle\n')
        final = tmp_path / 'final.avi'
        service.burn_subtitles(str(output), str(srt), final)
        output = final
    ffprobe = str(Path(service.ffmpeg_path).with_name('ffprobe'))
    probe = json.loads(subprocess.check_output([
        ffprobe, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(output)]))
    assert abs(float(probe['format']['duration']) - 1) < 0.05
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    assert audio['codec_name'] == 'pcm_s16le'
    assert not any(s['codec_type'] == 'subtitle' for s in probe['streams'])
    if subtitles:
        pixels = subprocess.check_output([
            service.ffmpeg_path, '-v', 'error', '-ss', '0.5', '-i', str(output),
            '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'])
        assert max(pixels[320 * 90:]) > 180, 'subtitle should be visible on black video'
