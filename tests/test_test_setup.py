"""Regression checks for collection and per-test isolation."""
import runpy
from pathlib import Path


def test_manual_api_script_is_not_a_pytest_suite():
    script = Path(__file__).resolve().parents[1] / 'test_api.py'
    namespace = runpy.run_path(str(script))
    assert namespace['__test__'] is False
    assert callable(namespace['main'])


def test_each_client_starts_with_empty_tasks(client):
    response = client.get('/api/v1/tasks')
    assert response.status_code == 200
    assert response.json() == []


def test_upload_creates_task_only_in_test_storage(client, monkeypatch):
    from app.api import upload
    from app.config import settings

    async def skip_asr(*args, **kwargs):
        pass

    monkeypatch.setattr(upload, 'process_asr_task', skip_asr)
    response = client.post('/api/v1/upload',
                           files={'file': ('sample.mp3', b'test content', 'audio/mpeg')})
    assert response.status_code == 200
    tasks = client.get('/api/v1/tasks').json()
    assert len(tasks) == 1
    assert Path(tasks[0]['file_path']).parent == settings.storage_path / 'uploads'


def test_previous_test_task_does_not_leak(client):
    assert client.get('/api/v1/tasks').json() == []
