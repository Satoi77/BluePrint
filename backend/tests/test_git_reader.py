import pytest

from app.scanner.git_reader import GitError, read_git_history


def test_reads_commit(repo, git):
    (repo / "a.py").write_text("import b\n", encoding="utf-8")
    (repo / "b.py").write_text("x = 1\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")
    history = read_git_history(repo)
    assert "a.py" in history
    assert "b.py" in history
    assert history["a.py"].message == "init"
    assert len(history["a.py"].hash) == 40


def test_untracked_file_has_no_history(repo, git):
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")
    (repo / "new.py").write_text("y = 1\n", encoding="utf-8")
    history = read_git_history(repo)
    assert "new.py" not in history
    assert "a.py" in history


def test_chinese_filename(repo, git):
    (repo / "中文模块.py").write_text("x = 1\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "cn")
    history = read_git_history(repo)
    assert "中文模块.py" in history


def test_empty_repo_returns_empty(repo):
    assert read_git_history(repo) == {}


def test_non_repo_raises(tmp_path):
    with pytest.raises(GitError):
        read_git_history(tmp_path)
