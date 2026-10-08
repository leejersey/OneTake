"""Regression checks for the output timeline, including real FFmpeg cuts."""
import json
import shutil
import subprocess
from copy import deepcopy

import pytest

from app.services.ffmpeg_service import FFmpegService
from app.services.subtitle_service import SubtitleService


def test_deleted_silences_are_subtracted():
    service = FFmpegService()
    edl = {
        'words': [{'start': 0, 'end': 1}, {'start': 4, 'end': 5}],
        'silence_segments': [
            {'start': 1, 'end': 3, 'auto_delete': True},
            {'start': 2, 'end': 4, 'user_delete': True},
        ],
    }
    assert service.extract_keep_segments(edl) == [(0, 1), (4, 5)]
    edl['silence_segments'] = [{'start': 1, 'end': 4, 'auto_delete': False}]
    assert service.extract_keep_segments(edl) == [(0, 5)]


def test_silence_can_remove_all_kept_content():
    assert FFmpegService().extract_keep_segments({
        'words': [{'start': 1, 'end': 2}],
        'silence_segments': [{'start': 0, 'end': 3, 'auto_delete': True}],
    }) == []


def test_srt_preserves_zero_start(tmp_path):
    output = tmp_path / 'zero.srt'
    SubtitleService.generate_srt([
        {'word': 'hello', 'start': 0, 'end': 0.5},
        {'word': 'world', 'start': 1, 'end': 1.5},
    ], str(output))
    assert '00:00:00,000 --> 00:00:01,500' in output.read_text()


def test_subtitles_use_kept_timeline_without_mutating_edl(tmp_path):
    words = [
        {'word': 'first', 'start': 3, 'end': 4},
        {'word': 'deleted', 'start': 4, 'end': 5, 'auto_delete': True},
        {'word': 'second', 'start': 7, 'end': 8},
        {'word': 'outside', 'start': 9, 'end': 10},
    ]
    original = deepcopy(words)
    mapped = SubtitleService.remap_words(words, [(3, 4), (7, 8)])
    assert [(w['word'], w['start'], w['end']) for w in mapped] == [
        ('first', 0, 1), ('second', 1, 2),
    ]
    assert words == original
    output = tmp_path / 'mapped.srt'
    SubtitleService.generate_srt(mapped, str(output))
    assert '00:00:00,000 --> 00:00:02,000' in output.read_text()


def test_subtitle_word_crossing_a_cut_is_clamped():
    mapped = SubtitleService.remap_words([
        {'word': 'crossing', 'start': 0.5, 'end': 4.5},
    ], [(1, 2), (4, 5)])
    assert [(w['start'], w['end']) for w in mapped] == [(0, 1.5)]


@pytest.mark.skipif(not shutil.which('ffmpeg') or not shutil.which('ffprobe'),
                    reason='FFmpeg and ffprobe required')
@pytest.mark.parametrize('with_audio', [False, True])
@pytest.mark.parametrize('multi', [False, True])
def test_non_keyframe_cut_is_exact(tmp_path, with_audio, multi):
    source = tmp_path / 'source.mp4'
    cmd = ['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
           'color=red:s=64x64:r=25:d=6']
    if with_audio:
        cmd += ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=6']
    cmd += ['-vf', "drawbox=color=blue:t=fill:enable='between(t,3,3.96)'",
            '-c:v', 'libx264', '-g', '1000', '-sc_threshold', '0',
            '-pix_fmt', 'yuv420p', '-y', str(source)]
    subprocess.run(cmd, check=True, capture_output=True)
    words = [{'start': 3, 'end': 3.5}]
    if multi:
        words += [{'start': 3.5, 'end': 4.5, 'user_delete': True},
                  {'start': 4.5, 'end': 5}]
    output = tmp_path / 'out.mp4'
    FFmpegService().clip_video(str(source), {'words': words, 'duration': 6},
                               output, quality='low')
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format',
        '-of', 'json', str(output),
    ]))
    expected = 1.0 if multi else 0.5
    assert abs(float(probe['format']['duration']) - expected) < 0.08
    assert any(s['codec_type'] == 'audio' for s in probe['streams']) == with_audio
    for stream in probe['streams']:
        assert abs(float(stream.get('start_time', 0))) < 0.05
    pixels = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(output), '-frames:v', '1',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
    ])
    assert pixels[2] > 180 and pixels[0] < 60, 'first frame must be blue, not pre-cut red'
    if multi:
        pixels = subprocess.check_output([
            'ffmpeg', '-v', 'error', '-ss', '0.75', '-i', str(output),
            '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
        ])
        assert pixels[0] > 180 and pixels[2] < 60, 'second kept segment must be red'
