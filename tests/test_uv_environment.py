"""Checks the supported environment entry points without installing packages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_uv_project_configuration():
    assert (ROOT / '.python-version').read_text().strip() == '3.10'
    project = (ROOT / 'pyproject.toml').read_text()
    assert 'requires-python = ">=3.10,<3.11"' in project
    assert '[dependency-groups]' in project
    assert '[tool.uv]' in project
    assert (ROOT / 'uv.lock').is_file()


def test_startup_scripts_use_uv():
    for name in ['start_api.sh', 'start_all.sh', 'quickstart.sh']:
        source = (ROOT / name).read_text()
        assert 'uv run' in source, name
        assert 'conda activate' not in source, name
        assert 'pip install' not in source, name
        assert 'cd "$(dirname "$0")"' in source, name


def test_docker_uses_locked_environment():
    source = (ROOT / 'Dockerfile').read_text()
    assert 'COPY pyproject.toml uv.lock .python-version' in source
    assert 'uv sync --locked --no-dev' in source
    assert 'pip install' not in source
    assert 'ENV PATH="/app/.venv/bin:$PATH"' in source
    assert '.venv' in (ROOT / '.dockerignore').read_text().splitlines()
