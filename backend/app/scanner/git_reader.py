import subprocess
from pathlib import Path

from app.models.schemas import CommitInfo

_RECORD_SEP = "\x1e"
_FIELD_SEP = "\x1f"


class GitError(Exception):
    pass


def _run(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(args, cwd=str(cwd), capture_output=True)
    except FileNotFoundError as exc:
        raise GitError("未找到 git 命令，请确认已安装 Git 并加入 PATH") from exc


def read_git_history(root: Path) -> dict[str, CommitInfo]:
    """单次调用 git log，建立「文件相对路径 -> 最近一次提交」映射。

    从新到旧遍历，每个文件首次出现即为最近提交。
    """
    check = _run(["git", "rev-parse", "--is-inside-work-tree"], root)
    if check.returncode != 0:
        raise GitError("指定目录不是 Git 仓库")

    head = _run(["git", "rev-parse", "--verify", "HEAD"], root)
    if head.returncode != 0:
        return {}

    proc = _run(
        [
            "git",
            "-c",
            "core.quotepath=false",
            "log",
            f"--pretty=format:{_RECORD_SEP}%H{_FIELD_SEP}%aI{_FIELD_SEP}%s",
            "--name-only",
        ],
        root,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", "replace").strip()
        raise GitError(f"git log 执行失败: {stderr or '未知错误'}")

    output = proc.stdout.decode("utf-8", "replace")
    history: dict[str, CommitInfo] = {}
    for block in output.split(_RECORD_SEP):
        lines = block.split("\n")
        if not lines or not lines[0].strip():
            continue
        header = lines[0].split(_FIELD_SEP)
        if len(header) < 3:
            continue
        commit_hash, iso_time, message = header[0], header[1], header[2]
        for line in lines[1:]:
            rel = line.strip()
            if rel and rel not in history:
                history[rel] = CommitInfo(
                    hash=commit_hash, iso_time=iso_time, message=message
                )
    return history
