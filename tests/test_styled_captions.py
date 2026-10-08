import json
from pathlib import Path
import subprocess

import numpy as np
import pytest
from pydantic import ValidationError
from app.models import SubtitleConfig
from app.services.ffmpeg_service import FFmpegService
from app.services.subtitle_service import SubtitleService
from app.config import settings


WORDS = json.loads((Path(__file__).parent / 'fixtures/caption_words.json').read_text())


def test_caption_groups_use_punctuation_gap_and_length():
    groups = SubtitleService.group_sentences(WORDS)
    assert [[w['word'] for w in group] for group in groups] == [
        ['大家', '好。'], ['删', '第一', '句'], ['下一', '句！'], ['尾巴']]
    assert [len(group) for group in SubtitleService.group_sentences([
        {'word': 'a', 'start': i / 10, 'end': (i + 1) / 10} for i in range(19)
    ])] == [18, 1]


def test_ass_style_and_original_sentence_boundaries_survive_cuts(tmp_path):
    output = tmp_path / 'captions.ass'
    SubtitleService.generate_ass(WORDS, str(output), [(0, 0.6), (0.85, 1.2), (2, 2.6)],
        {'font_name': 'Arial', 'font_size': 24, 'color': '#FF0000',
         'outline_color': '#0000FF', 'outline_width': 2, 'position': 'top'}, 640, 360)
    text = output.read_text()
    assert 'PlayResX: 384' in text and 'PlayResY: 216' in text
    assert 'WrapStyle: 1' in text
    assert 'Arial,24,&H000000FF,&H000000FF,&H00FF0000' in text
    assert ',8,12,12,16,' in text
    assert '大家好。' in text and '第一句' in text and '删' not in text
    assert '0:00:00.60,0:00:00.95' in text
    assert '0:00:00.95,0:00:01.35' in text


@pytest.mark.parametrize('data', [
    {'font_name': 'Arial,Override'}, {'font_name': 'Arial\nStyle: injected'},
    {'color': "red':evil"}, {'outline_color': 'invalid'},
    {'font_size': -1}, {'outline_width': -1}, {'position': 'sideways'},
])
def test_subtitle_style_rejects_invalid_ass_values(data):
    with pytest.raises(ValidationError):
        SubtitleConfig(**data)


@pytest.mark.parametrize('fmt', ['mp4', 'mov', 'avi'])
def test_hard_caption_style_is_visible_in_every_export_format(tmp_path, fmt):
    service = FFmpegService(settings.ffmpeg_path)
    source = tmp_path / 'source.mp4'
    subprocess.run([settings.ffmpeg_path, '-v', 'error', '-f', 'lavfi', '-i',
        'color=black:s=320x180:r=25:d=1', '-c:v', 'libx264', '-y', str(source)], check=True)
    captions = tmp_path / 'captions.ass'
    SubtitleService.generate_ass([{'word': 'HELLO', 'start': 0, 'end': 1}], str(captions),
        [(0, 1)], {'font_name': 'Arial', 'font_size': 24, 'color': '#FF0000',
        'outline_color': '#0000FF', 'outline_width': 2, 'position': 'top'}, 320, 180)
    output = tmp_path / f'output.{fmt}'
    service.burn_subtitles(str(source), str(captions), output, quality='low')
    raw = subprocess.check_output([settings.ffmpeg_path, '-v', 'error', '-i', str(output),
        '-ss', '0.25', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    frame = np.frombuffer(raw, dtype=np.uint8).reshape(180, 320, 3)
    red = (frame[:, :, 0] > 150) & (frame[:, :, 1] < 80) & (frame[:, :, 2] < 80)
    assert red.sum() > 40
    assert np.where(red)[0].max() < 90, 'top captions must appear in the top half'
    probe = json.loads(subprocess.check_output([str(Path(settings.ffmpeg_path).with_name('ffprobe')),
        '-v', 'error', '-show_streams', '-of', 'json', str(output)]))
    assert not any(stream['codec_type'] == 'subtitle' for stream in probe['streams'])
