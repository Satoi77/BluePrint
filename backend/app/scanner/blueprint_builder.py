from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.schemas import CommitInfo, EdgeModel, FileMeta, ImportRef, NodeModel


def _build_module_index(files: list[FileMeta]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for file in files:
        index.setdefault(file.module_dotted, []).append(file.rel_path)
    return index


def _lookup(candidate: str, module_index: dict[str, list[str]]) -> Optional[str]:
    """在模块索引中查找候选模块名。

    先精确匹配；失败时，对含包边界的多段名（如 app.services.x）做后缀匹配，
    以兼容"仓库根 = 扫描根、包根在其子目录（如 backend/）"的常见布局。
    单段名（os/logging 等）不做后缀匹配，避免与三方库/标准库误连。
    """
    if candidate in module_index:
        return sorted(module_index[candidate], key=len)[0]
    if "." in candidate:
        suffix = "." + candidate
        paths: list[str] = []
        for name, name_paths in module_index.items():
            if name.endswith(suffix):
                paths.extend(name_paths)
        if paths:
            return sorted(paths, key=len)[0]
    return None


def _resolve(
    ref: ImportRef, owner: FileMeta, module_index: dict[str, list[str]]
) -> Optional[str]:
    """把一条 import 解析为目标文件的相对路径；解析不到（三方库等）返回 None。"""
    candidates: list[str] = []

    if ref.level == 0:
        if ref.kind == "import":
            if ref.module:
                candidates.append(ref.module)
                candidates.append(ref.module.split(".")[0])
        else:
            base = ref.module or ""
            for name in ref.names:
                if name != "*":
                    candidates.append(f"{base}.{name}" if base else name)
            if base:
                candidates.append(base)
    else:
        pkg_parts = owner.module_dotted.split(".") if owner.module_dotted else []
        base_parts = pkg_parts if owner.is_package else pkg_parts[:-1]
        up = ref.level - 1
        if up > 0:
            base_parts = base_parts[: len(base_parts) - up] if up <= len(base_parts) else []
        base = ".".join(base_parts)

        if ref.kind == "import":
            for name in ref.names:
                if name != "*":
                    candidates.append(f"{base}.{name}" if base else name)
        else:
            module = ref.module or ""
            full = f"{base}.{module}" if base and module else (base or module)
            for name in ref.names:
                if name != "*":
                    candidates.append(f"{full}.{name}" if full else name)
            if full:
                candidates.append(full)

    for candidate in candidates:
        resolved = _lookup(candidate, module_index)
        if resolved is not None:
            return resolved
    return None


def _compute_status(
    rel_path: str,
    history: dict[str, CommitInfo],
    now: datetime,
    recent_days: int,
) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
    commit = history.get(rel_path)
    if commit is None:
        return "uncommitted", None, None, None

    try:
        committed_at = datetime.fromisoformat(commit.iso_time)
    except ValueError:
        committed_at = None
    if committed_at is not None and committed_at.tzinfo is None:
        committed_at = committed_at.replace(tzinfo=timezone.utc)

    if committed_at is not None and (now - committed_at) < timedelta(days=recent_days):
        status = "recent"
    else:
        status = "old"
    return status, commit.iso_time, commit.hash, commit.message


def build_blueprint(
    files: list[FileMeta],
    history: dict[str, CommitInfo],
    recent_days: int = 7,
    now: Optional[datetime] = None,
) -> tuple[list[NodeModel], list[EdgeModel]]:
    if now is None:
        now = datetime.now(timezone.utc)

    module_index = _build_module_index(files)

    edges: list[EdgeModel] = []
    seen_edges: set[tuple[str, str]] = set()
    in_degree: dict[str, int] = {}
    out_degree: dict[str, int] = {}

    for owner in files:
        for ref in owner.imports:
            target = _resolve(ref, owner, module_index)
            if target is None or target == owner.rel_path:
                continue
            key = (owner.rel_path, target)
            if key in seen_edges:
                continue
            seen_edges.add(key)
            edges.append(EdgeModel(source=owner.rel_path, target=target))
            out_degree[owner.rel_path] = out_degree.get(owner.rel_path, 0) + 1
            in_degree[target] = in_degree.get(target, 0) + 1

    nodes: list[NodeModel] = []
    for file in files:
        status, last_time, last_hash, last_message = _compute_status(
            file.rel_path, history, now, recent_days
        )
        is_isolated = (
            in_degree.get(file.rel_path, 0) == 0
            and out_degree.get(file.rel_path, 0) == 0
        )
        nodes.append(
            NodeModel(
                id=file.rel_path,
                label=file.rel_path.split("/")[-1],
                file_path=file.rel_path,
                absolute_path=file.abs_path,
                last_commit_time=last_time,
                last_commit_hash=last_hash,
                last_commit_message=last_message,
                status=status,
                module_name=file.module_dotted,
                functions=file.functions,
                is_isolated=is_isolated,
            )
        )

    return nodes, edges
