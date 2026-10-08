"""Keep test collection and API lifespan away from real storage."""
from tempfile import TemporaryDirectory

import pytest


def pytest_configure(config):
    # Settings and log handlers are initialized while modules are imported.
    storage = TemporaryDirectory(prefix='onetake-pytest-')
    patch = pytest.MonkeyPatch()
    patch.setenv('STORAGE_PATH', storage.name)
    patch.setenv('DATABASE_URL', f'sqlite+aiosqlite:///{storage.name}/collection.db')
    config.add_cleanup(patch.undo)
    config.add_cleanup(storage.cleanup)


@pytest.fixture
def client(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app import database
    from app.config import settings
    from app.main import app, limiter
    from app.services.cleanup import cleanup_service
    import app.utils.task_manager as task_manager_module

    database_url = f'sqlite+aiosqlite:///{tmp_path}/tasks.db'
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(database, 'engine', engine)
    monkeypatch.setattr(database, 'async_session_maker', factory)
    monkeypatch.setattr(task_manager_module, 'async_session_maker', factory)
    monkeypatch.setattr(settings, 'database_url', database_url)
    monkeypatch.setattr(settings, 'storage_path', tmp_path / 'storage')
    monkeypatch.setattr(cleanup_service, 'storage_path', settings.storage_path)
    settings.ensure_storage_paths()
    limiter.reset()
    try:
        # Entering the context runs startup (including init_db) and shutdown.
        with TestClient(app) as test_client:
            yield test_client
    finally:
        limiter.reset()
