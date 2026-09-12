import os
import subprocess
from pathlib import Path

import pytest


def run_git(root: Path, *args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    return subprocess.run(
        ["git", *args],
        cwd=str(root),
        check=True,
        capture_output=True,
        text=True,
        env=full_env,
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    root = tmp_path / "proj"
    root.mkdir()
    run_git(root, "init")
    run_git(root, "config", "user.email", "test@example.com")
    run_git(root, "config", "user.name", "Test")
    run_git(root, "config", "commit.gpgsign", "false")
    return root


@pytest.fixture
def git(repo: Path):
    def _run(*args: str, env: dict | None = None) -> subprocess.CompletedProcess:
        return run_git(repo, *args, env=env)

    return _run


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """把应用数据库指向临时文件，避免测试污染真实 DB。"""
    from app import config
    from app.services import logging_db, project_store

    monkeypatch.setattr(config, "DB_PATH", tmp_path / "blueprint_test.db")
    logging_db._initialized = False
    project_store._initialized = False
    yield
    logging_db._initialized = False
    project_store._initialized = False
