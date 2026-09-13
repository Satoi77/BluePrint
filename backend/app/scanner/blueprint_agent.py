from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.schemas import CommitInfo, EdgeModel, FileMeta, NodeModel
from app.scanner.call_graph import build_call_edges

_LEVEL_KIND = {0: "block", 1: "group", 2: "atomic"}


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _aggregate_status(
    paths: list[str],
    file_map: dict[str, NodeModel],
    history: Optional[dict[str, CommitInfo]],
    now: datetime,
    recent_days: int,
) -> tuple[str, Optional[str], Optional[str], Optional[str]]:
    """按功能涉及的文件聚合最近一次提交（语言无关）。"""
    best_dt: Optional[datetime] = None
    best: Optional[tuple] = None
    for path in paths:
        node = file_map.get(path)
        if node is not None and node.last_commit_time:
            committed = _parse_iso(node.last_commit_time)
            if committed and (best_dt is None or committed > best_dt):
                best_dt = committed
                best = (
                    node.status,
                    node.last_commit_time,
                    node.last_commit_hash,
                    node.last_commit_message,
                )
        elif history and path in history:
            commit = history[path]
            committed = _parse_iso(commit.iso_time)
            if committed:
                status = (
                    "recent"
                    if (now - committed) < timedelta(days=recent_days)
                    else "old"
                )
                if best_dt is None or committed > best_dt:
                    best_dt = committed
                    best = (status, commit.iso_time, commit.hash, commit.message)
    if best is not None:
        return best
    return ("uncommitted", None, None, None)


def validate_agent_blueprint(
    blueprint: dict, files: list[FileMeta], ignored: Optional[list[str]] = None
) -> list[str]:
    """校验 Agent 蓝图：id 唯一、parent 合法、level/kind 一致、边端点存在、文件覆盖率。"""
    warnings: list[str] = []
    functions = blueprint.get("functions") or []
    if not functions:
        return ["蓝图未包含任何功能节点"]

    ids: set[str] = set()
    by_id: dict[str, dict] = {}
    for item in functions:
        fid = item.get("id")
        if not fid:
            warnings.append("存在缺少 id 的功能节点")
            continue
        if fid in ids:
            warnings.append(f"功能 id 重复: {fid}")
        ids.add(fid)
        by_id[fid] = item

    for item in functions:
        fid = item.get("id")
        level = item.get("level")
        kind = item.get("kind")
        if level in _LEVEL_KIND and kind and kind != _LEVEL_KIND[level]:
            warnings.append(f"{fid}: level={level} 与 kind={kind} 不一致")
        parent = item.get("parent")
        if parent is not None:
            if parent not in by_id:
                warnings.append(f"{fid}: parent 不存在: {parent}")
            elif by_id[parent].get("level") != (
                level - 1 if isinstance(level, int) else None
            ):
                warnings.append(f"{fid}: parent 层级不连续")

    for edge in blueprint.get("edges") or []:
        if edge.get("source") not in ids or edge.get("target") not in ids:
            warnings.append(
                f"边端点不存在: {edge.get('source')} -> {edge.get('target')}"
            )

    # 文件覆盖率：仅校验软件已扫描到的源文件（Python）
    ignored = ignored or blueprint.get("ignored") or []
    covered: set[str] = set()
    for item in functions:
        for path in item.get("files") or []:
            covered.add(path.replace("\\", "/"))
    for meta in files:
        rel = meta.rel_path
        if rel in covered:
            continue
        if any(rel.startswith(prefix) for prefix in ignored):
            continue
        warnings.append(f"文件未被任何功能覆盖: {rel}")

    return warnings


def build_from_agent_blueprint(
    blueprint: dict,
    file_nodes: list[NodeModel],
    files: Optional[list[FileMeta]] = None,
    history: Optional[dict[str, CommitInfo]] = None,
    recent_days: int = 7,
    now: Optional[datetime] = None,
) -> tuple[list[NodeModel], list[EdgeModel]]:
    """把 Agent 功能蓝图转换为可渲染的节点/边（语言无关）。

    - 状态：按功能涉及的任意文件路径从 Git 历史聚合（前端等非 Python 文件亦可）。
    - 原子层：Python 文件由软件列函数；非 Python 文件用 Agent 声明的 `symbols`。
    """
    if now is None:
        now = datetime.now(timezone.utc)

    file_map = {node.file_path: node for node in file_nodes}
    functions = blueprint.get("functions") or []
    symbol_names = blueprint.get("symbol_names") or {}
    symbols_by_file: dict[str, list[str]] = {}
    if files:
        symbols_by_file = {
            meta.rel_path: list(meta.functions) + list(meta.classes)
            for meta in files
        }

    nodes: list[NodeModel] = []
    level_of: dict[str, int] = {}
    for item in functions:
        fid = item.get("id")
        if not fid:
            continue
        level = int(item.get("level", 2))
        level_of[fid] = level
        paths = list(item.get("files") or [])
        status, last_time, last_hash, last_message = _aggregate_status(
            paths, file_map, history, now, recent_days
        )
        nodes.append(
            NodeModel(
                id=fid,
                label=item.get("name") or fid,
                file_path=fid,
                absolute_path="",
                last_commit_time=last_time,
                last_commit_hash=last_hash,
                last_commit_message=last_message,
                status=status,
                module_name="",
                functions=list(item.get("symbols") or []),
                is_isolated=bool(item.get("isolated", False)),
                group=item.get("parent") or fid,
                files=paths,
                level=level,
                parent_id=item.get("parent"),
                kind=item.get("kind") or _LEVEL_KIND.get(level, "atomic"),
                member_count=len(paths),
            )
        )

    edges: list[EdgeModel] = []
    seen: set[tuple[str, str]] = set()
    for edge in blueprint.get("edges") or []:
        source = edge.get("source")
        target = edge.get("target")
        if source not in level_of or target not in level_of:
            continue
        if (source, target) in seen:
            continue
        seen.add((source, target))
        edges.append(
            EdgeModel(
                source=source,
                target=target,
                relation=edge.get("type") or "import",
                label=edge.get("label") or "",
                level=max(level_of[source], level_of[target]),
                weight=1,
            )
        )

    # 机械补齐 L2 原子功能：对**尚未显式给出 L2 子节点**的 L1 逐个补齐
    parents_with_l2 = {node.parent_id for node in nodes if node.level == 2}
    for node in list(nodes):
        if node.level != 1 or node.id in parents_with_l2:
            continue
        collected: list[tuple[str, str]] = []
        has_python = False
        for path in node.files:
            python_symbols = symbols_by_file.get(path)
            if python_symbols:
                has_python = True
                for symbol in python_symbols:
                    collected.append((symbol, path))
        if not has_python:
            # 非 Python 文件：采用 Agent 声明的符号
            fallback_path = node.files[0] if node.files else node.id
            for symbol in node.functions:
                collected.append((symbol, fallback_path))
        seen_symbols: set[str] = set()
        for symbol, path in collected:
            key = f"{node.id}::{path}::{symbol}"
            if key in seen_symbols:
                continue
            seen_symbols.add(key)
            nodes.append(
                NodeModel(
                    id=key,
                    label=symbol_names.get(f"{path}::{symbol}")
                    or symbol_names.get(symbol)
                    or symbol,
                    file_path=path,
                    absolute_path="",
                    last_commit_time=node.last_commit_time,
                    last_commit_hash=node.last_commit_hash,
                    last_commit_message=node.last_commit_message,
                    status=node.status,
                    module_name="",
                    functions=[symbol],
                    is_isolated=False,
                    group=node.id,
                    files=[path],
                    level=2,
                    parent_id=node.id,
                    kind="atomic",
                    member_count=1,
                )
            )

    # 原子级调用边（仅对软件可解析的 Python 文件）
    if files:
        symbol_node: dict[tuple[str, str], str] = {}
        for node in nodes:
            if node.level == 2 and node.files and node.functions:
                symbol_node.setdefault(
                    (node.files[0], node.functions[0]), node.id
                )
        if symbol_node:
            for caller_file, caller_symbol, target_file, target_symbol in (
                build_call_edges(files)
            ):
                source = symbol_node.get((caller_file, caller_symbol))
                target = symbol_node.get((target_file, target_symbol))
                if not source or not target or source == target:
                    continue
                if (source, target) in seen:
                    continue
                seen.add((source, target))
                edges.append(
                    EdgeModel(
                        source=source,
                        target=target,
                        relation="call",
                        level=2,
                        weight=1,
                    )
                )

    # 无任何边且未显式标注者，也视为孤立
    degree: dict[str, int] = {}
    for edge in edges:
        degree[edge.source] = degree.get(edge.source, 0) + 1
        degree[edge.target] = degree.get(edge.target, 0) + 1
    for node in nodes:
        if degree.get(node.id, 0) == 0:
            node.is_isolated = True

    return nodes, edges
