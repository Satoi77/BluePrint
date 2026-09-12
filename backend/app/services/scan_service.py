import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import RECENT_DAYS
from app.models.schemas import ScanResponse, ScanStats
from app.scanner.blueprint_builder import aggregate_by_function, build_blueprint
from app.scanner.git_reader import GitError, read_git_history
from app.scanner.project_scanner import scan_python_files
from app.services.logging_db import log
from app.services.project_store import save_project


class ScanError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def validate_project_path(project_path: str) -> Path:
    path = Path(project_path).expanduser()
    if not path.exists():
        raise ScanError(f"项目路径不存在: {project_path}", 400)
    if not path.is_dir():
        raise ScanError(f"路径不是目录: {project_path}", 400)
    if not (path / ".git").exists():
        raise ScanError(f"目录中未找到 .git，无法读取提交历史: {project_path}", 400)
    return path.resolve()


def scan_project(
    project_path: str,
    name: Optional[str] = None,
    granularity: str = "function",
) -> ScanResponse:
    started = time.time()
    log("info", "services.scan_service", "开始扫描", {"project_path": project_path})

    root = validate_project_path(project_path)

    scan_started = time.time()
    files, skipped, warnings = scan_python_files(root)
    scan_elapsed = time.time() - scan_started
    log(
        "info",
        "services.scan_service",
        "文件扫描完成",
        {"files": len(files), "skipped": skipped, "elapsed": round(scan_elapsed, 3)},
    )

    git_started = time.time()
    try:
        history = read_git_history(root)
    except GitError as exc:
        log(
            "error",
            "services.scan_service",
            "Git 读取失败",
            {"project_path": project_path},
            exc=exc,
        )
        raise ScanError(f"Git 读取失败: {exc}", 500)
    git_elapsed = time.time() - git_started

    nodes, edges = build_blueprint(files, history, RECENT_DAYS)
    if granularity == "function":
        nodes, edges = aggregate_by_function(nodes, edges)

    if not files:
        warnings.append("未发现可解析的 Python 文件")
    for warning in warnings:
        log("warn", "services.scan_service", warning)

    response = ScanResponse(
        project_path=str(root),
        generated_at=datetime.now(timezone.utc).isoformat(),
        nodes=nodes,
        edges=edges,
        stats=ScanStats(
            files_scanned=len(files),
            files_skipped=skipped,
            node_count=len(nodes),
            edge_count=len(edges),
        ),
        warnings=warnings,
    )

    project = save_project(root, response, name)
    response.project_id = project["id"]
    response.project_name = project["name"]

    log(
        "info",
        "services.scan_service",
        "扫描完成",
        {
            "nodes": len(nodes),
            "edges": len(edges),
            "scan_elapsed": round(scan_elapsed, 3),
            "git_elapsed": round(git_elapsed, 3),
            "total_elapsed": round(time.time() - started, 3),
        },
    )
    return response
