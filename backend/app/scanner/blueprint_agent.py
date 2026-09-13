from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import EdgeModel, FileMeta, NodeModel
from app.scanner.call_graph import build_call_edges

_LEVEL_KIND = {0: "block", 1: "group", 2: "atomic"}


def _latest_time(members: list[NodeModel]) -> Optional[datetime]:
    best: Optional[datetime] = None
    for member in members:
        if not member.last_commit_time:
            continue
        try:
            committed = datetime.fromisoformat(member.last_commit_time)
        except ValueError:
            continue
        if committed.tzinfo is None:
            committed = committed.replace(tzinfo=timezone.utc)
        if best is None or committed > best:
            best = committed
    return best


def _pick_latest(members: list[NodeModel]) -> Optional[NodeModel]:
    best: Optional[NodeModel] = None
    best_dt: Optional[datetime] = None
    for member in members:
        if not member.last_commit_time:
            continue
        try:
            committed = datetime.fromisoformat(member.last_commit_time)
        except ValueError:
            continue
        if committed.tzinfo is None:
            committed = committed.replace(tzinfo=timezone.utc)
        if best_dt is None or committed > best_dt:
            best_dt = committed
            best = member
    return best


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
            elif by_id[parent].get("level") != (level - 1 if isinstance(level, int) else None):
                warnings.append(f"{fid}: parent 层级不连续")

    for edge in blueprint.get("edges") or []:
        if edge.get("source") not in ids or edge.get("target") not in ids:
            warnings.append(
                f"边端点不存在: {edge.get('source')} -> {edge.get('target')}"
            )

    # 文件覆盖率
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
) -> tuple[list[NodeModel], list[EdgeModel]]:
    """把 Agent 产出的功能蓝图转换为可渲染的节点/边，并用 Git 数据增强状态。"""
    file_map = {node.file_path: node for node in file_nodes}
    functions = blueprint.get("functions") or []
    symbol_names = blueprint.get("symbol_names") or {}

    nodes: list[NodeModel] = []
    level_of: dict[str, int] = {}
    for item in functions:
        fid = item.get("id")
        if not fid:
            continue
        level = int(item.get("level", 2))
        level_of[fid] = level
        members = [
            file_map[path]
            for path in (item.get("files") or [])
            if path in file_map
        ]
        latest = _pick_latest(members)
        nodes.append(
            NodeModel(
                id=fid,
                label=item.get("name") or fid,
                file_path=fid,
                absolute_path="",
                last_commit_time=latest.last_commit_time if latest else None,
                last_commit_hash=latest.last_commit_hash if latest else None,
                last_commit_message=latest.last_commit_message if latest else None,
                status=latest.status if latest else "uncommitted",
                module_name="",
                functions=list(item.get("symbols") or []),
                is_isolated=bool(item.get("isolated", False)),
                group=item.get("parent") or fid,
                files=list(item.get("files") or []),
                level=level,
                parent_id=item.get("parent"),
                kind=item.get("kind") or _LEVEL_KIND.get(level, "atomic"),
                member_count=len(item.get("files") or []),
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

    # 机械补齐 L2 原子功能：Agent 只做语义分组（L0/L1），
    # 原子功能由软件从 L1 功能的文件里列出函数/类。Agent 显式给出 L2 时不覆盖。
    symbols_by_file: dict[str, list[str]] = {}
    if files:
        symbols_by_file = {
            meta.rel_path: list(meta.functions) + list(meta.classes)
            for meta in files
        }
    if not any(node.level == 2 for node in nodes):
        for node in list(nodes):
            if node.level != 1:
                continue
            seen_symbols: set[str] = set()
            for path in node.files:
                file_node = file_map.get(path)
                if file_node is None:
                    continue
                symbols = symbols_by_file.get(path) or list(file_node.functions)
                for symbol in symbols:
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
                            absolute_path=file_node.absolute_path,
                            last_commit_time=file_node.last_commit_time,
                            last_commit_hash=file_node.last_commit_hash,
                            last_commit_message=file_node.last_commit_message,
                            status=file_node.status,
                            module_name=file_node.module_name,
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

    # 原子级调用边（机械分析：同文件调用 / 导入符号调用 / 模块.函数 调用）
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
