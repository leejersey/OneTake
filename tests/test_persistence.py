"""EDL persistence, export recovery and safe cleanup regressions."""
import asyncio
import os
import time
import subprocess
import sys
from pathlib import Path

import pytest

from app.models import TaskStatus
from app.utils.task_manager import task_manager


@pytest.fixture
def task(client):
    from app.config import settings
    source = settings.storage_path / 'uploads' / 'source.mp4'
    source.write_bytes(b'test video')
    edl = {'duration': 5, 'statistics': None, 'original_audio': str(source), 'words': [
        {'word': 'hello', 'start': 1, 'end': 2, 'type': 'normal'}]}

    async def seed():
        task_id = await task_manager.create_task(str(source), 'en')
        await task_manager.update_task(task_id, status=TaskStatus.COMPLETED, result=edl)
        return task_id

    return client.portal.call(seed)


def test_save_edl_persists_only_editable_data(client, task):
    response = client.put(f'/api/v1/tasks/{task}/edl', json={
        'original_audio': '/etc/passwd', 'duration': 999,
        'words': [{'word': 'edited', 'start': 1, 'end': 2, 'user_delete': True}],
    })
    assert response.status_code == 200
    saved = client.get(f'/api/v1/tasks/{task}/edl').json()
    assert saved['words'][0]['word'] == 'edited'
    assert saved['words'][0]['user_delete'] is True
    assert saved['duration'] == 5
    assert saved['original_audio'] != '/etc/passwd'


@pytest.mark.parametrize('start,end', [(-1, 2), (2, 1), (1, 6)])
def test_save_rejects_invalid_times_without_overwriting(client, task, start, end):
    response = client.put(f'/api/v1/tasks/{task}/edl', json={
        'words': [{'word': 'invalid', 'start': start, 'end': end}],
    })
    assert response.status_code == 422
    assert client.get(f'/api/v1/tasks/{task}/edl').json()['words'][0]['word'] == 'hello'


def test_save_accepts_zero_duration_tokens_from_asr(client, task):
    words = [{'word': '。', 'start': 0, 'end': 0}, {'word': 'hello', 'start': 1, 'end': 2}]
    response = client.put(f'/api/v1/tasks/{task}/edl', json={'words': words})
    assert response.status_code == 200
    assert response.json()['words'][0]['end'] == 0


def test_missing_edl_save_is_404(client):
    assert client.put('/api/v1/tasks/missing/edl', json={'words': []}).status_code == 404


def test_export_survives_manager_recreation(client, task):
    from app.utils.task_manager import TaskManager
    from app.config import settings
    output = settings.storage_path / 'exports' / 'persisted.avi'
    output.write_bytes(b'export')

    async def seed():
        export_id = await task_manager.create_export(task)
        await task_manager.update_export(export_id, status='completed', progress=100,
                                         output_file=str(output))
        assert (await TaskManager().get_export(export_id))['output_file'] == str(output)
        return export_id

    export_id = client.portal.call(seed)
    assert client.get(f'/api/v1/exports/{export_id}').json()['status'] == 'completed'
    response = client.get(f'/api/v1/exports/{export_id}/download')
    assert response.content == b'export'
    assert response.headers['content-type'] == 'video/x-msvideo'


def test_recovery_fails_only_interrupted_jobs(client, task):
    async def check():
        pending = await task_manager.create_task('pending.mp3')
        processing = await task_manager.create_task('processing.mp3')
        await task_manager.update_task(processing, status=TaskStatus.PROCESSING)
        active_export = await task_manager.create_export(task)
        finished_export = await task_manager.create_export(task)
        await task_manager.update_export(finished_export, status='completed', progress=100)
        await task_manager.recover_interrupted_tasks()
        for task_id in [pending, processing]:
            item = await task_manager.get_task(task_id)
            assert item.status == TaskStatus.FAILED
            assert '中断' in item.error
        assert (await task_manager.get_export(active_export))['status'] == 'failed'
        assert (await task_manager.get_export(finished_export))['status'] == 'completed'
        assert (await task_manager.get_task(task)).status == TaskStatus.COMPLETED
    client.portal.call(check)


def test_retry_failed_task_reuses_source_and_clears_error(client, task, monkeypatch):
    from app.api import upload
    called = []

    async def process(task_id, file_path, language=None, model_size=None):
        called.append((task_id, file_path, language))

    monkeypatch.setattr(upload, 'process_asr_task', process)
    client.portal.call(task_manager.update_task, task, TaskStatus.FAILED, 25, None, 'interrupted')
    response = client.post(f'/api/v1/tasks/{task}/retry')
    assert response.status_code == 200
    status = client.get(f'/api/v1/tasks/{task}').json()
    assert status['status'] == 'pending' and status['progress'] == 0
    assert status['error'] is None
    assert called[0][0] == task and called[0][2] == 'en'
    assert client.post(f'/api/v1/tasks/{task}/retry').status_code == 400


def test_task_routes_can_be_imported_without_a_circular_app_import():
    subprocess.run([sys.executable, '-c', 'import app.api.tasks'], check=True, capture_output=True)


def test_retry_obeys_existing_upload_rate_policy(client):
    statuses = [client.post('/api/v1/tasks/missing/retry').status_code for _ in range(11)]
    assert statuses == [404] * 10 + [429]


def test_cleanup_protects_referenced_and_active_export_files(client, task):
    from app.config import settings
    from app.services.cleanup import cleanup_service

    async def check():
        export_id = await task_manager.create_export(task)
        active = settings.storage_path / 'exports' / f'{export_id}.srt'
        active.write_bytes(b'active')
        finished_id = await task_manager.create_export(task)
        finished = settings.storage_path / 'exports' / f'{finished_id}_final.mp4'
        finished.write_bytes(b'finished')
        await task_manager.update_export(finished_id, status='completed', output_file=str(finished))
        source = Path((await task_manager.get_task_info(task))['file_path'])
        orphan = settings.storage_path / 'uploads' / 'orphan.mp3'
        orphan.write_bytes(b'orphan')
        for file in [active, finished, source, orphan]:
            os.utime(file, (time.time() - 172800,) * 2)
        await cleanup_service.cleanup_once()
        assert active.exists() and finished.exists() and source.exists()
        assert not orphan.exists()
    client.portal.call(check)


def test_cleanup_does_not_delete_when_database_is_unavailable(client, monkeypatch):
    from app.config import settings
    from app.services.cleanup import cleanup_service
    orphan = settings.storage_path / 'uploads' / 'old.mp3'
    orphan.write_bytes(b'old')
    os.utime(orphan, (time.time() - 172800,) * 2)

    async def fail():
        raise RuntimeError('database offline')

    monkeypatch.setattr(task_manager, 'get_protected_files', fail)
    with pytest.raises(RuntimeError, match='database offline'):
        client.portal.call(cleanup_service.cleanup_once)
    assert orphan.exists()


def test_export_and_model_initialization_do_not_block_event_loop(client, task, monkeypatch):
    from app.api import export, upload
    from app.config import settings
    from app.models import ExportRequest

    class FakeFFmpeg:
        def __init__(self, **kwargs):
            time.sleep(0.08)
        def clip_video(self, input_video, edl, output_path, quality):
            time.sleep(0.08)
            output_path.write_bytes(b'video')
            return str(output_path)

    class FakeASR:
        def __init__(self, **kwargs):
            time.sleep(0.15)
        def process(self, *args, **kwargs):
            return {'words': []}

    monkeypatch.setattr(export, 'FFmpegService', FakeFFmpeg)
    monkeypatch.setattr(upload, 'ASRService', FakeASR)

    async def check():
        async def responsive(job):
            started = time.monotonic()
            operation = asyncio.create_task(job)
            await asyncio.sleep(0.02)
            elapsed = time.monotonic() - started
            await operation
            assert elapsed < 0.1, f'event loop blocked for {elapsed:.3f}s'
        export_id = await task_manager.create_export(task)
        await responsive(export.process_export_task(export_id, task, ExportRequest()))
        assert (await task_manager.get_export(export_id))['status'] == 'completed'
        asr_id = await task_manager.create_task(str(settings.storage_path / 'uploads' / 'audio.mp3'))
        await responsive(upload.process_asr_task(asr_id, 'audio.mp3'))
        assert (await task_manager.get_task(asr_id)).status == TaskStatus.COMPLETED
    client.portal.call(check)
