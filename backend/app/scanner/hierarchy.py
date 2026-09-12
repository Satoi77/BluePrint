from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import EdgeModel, FileMeta, NodeModel

BLOCK_PREFIX = "block:"
OTHER_BLOCK_ID = "other"
OTHER_BLOCK_NAME = "其他"


def _dir_key(file_path: str) -> str:
    return file_path.rsplit("/", 1)[0] if "/" in file_path else "(root)"


def _latest(members: list[NodeModel]) -> Optional[NodeModel]:
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


def _assign_blocks(
    file_paths: list[str], mapping: Optional[dict]
) -> tuple[dict[str, str], dict[str, str]]:
    """返回 (file_path -> block_id, block_id -> block_name)。"""
    assignment: dict[str, str] = {}
    names: dict[str, str] = {}

    if mapping and mapping.get("blocks"):
        for block in mapping["blocks"]:
            block_id = str(block.get("id") or block.get("name"))
            names[block_id] = block.get("name") or block_id
            for path in block.get("files", []):
                assignment[path] = block_id

    # 未映射的文件：无 AI 映射时按顶层目录分块；有映射时归入"其他"
    for path in file_paths:
        if path in assignment:
            continue
        if mapping and mapping.get("blocks"):
            assignment[path] = OTHER_BLOCK_ID
            names.setdefault(OTHER_BLOCK_ID, OTHER_BLOCK_NAME)
        else:
            block_id = _dir_key(path).split("/")[0]
            assignment[path] = block_id
            names.setdefault(block_id, block_id)

    return assignment, names


def build_function_hierarchy(
    files: list[FileMeta],
    file_nodes: list[NodeModel],
    file_edges: list[EdgeModel],
    mapping: Optional[dict] = None,
) -> tuple[list[NodeModel], list[EdgeModel]]:
    """构建分层功能图：L0 大功能块 → L1 文件/子功能 → L2 原子功能。

    - 边只存在于 L1（文件 import）与 L0（块间聚合）；L2 原子功能无独立边。
    - 无连线者标记 is_isolated，供前端孤立功能池展示。
    """
    file_paths = [node.file_path for node in file_nodes]
    assignment, block_names = _assign_blocks(file_paths, mapping)
    mapping_isolated = set((mapping or {}).get("isolated", []))

    # L1 文件边 + 度数
    in_deg: dict[str, int] = {}
    out_deg: dict[str, int] = {}
    level1_edges: list[EdgeModel] = []
    seen1: set[tuple[str, str]] = set()
    for edge in file_edges:
        key = (edge.source, edge.target)
        if key in seen1:
            continue
        seen1.add(key)
        level1_edges.append(EdgeModel(source=edge.source, target=edge.target, level=1))
        out_deg[edge.source] = out_deg.get(edge.source, 0) + 1
        in_deg[edge.target] = in_deg.get(edge.target, 0) + 1

    # L0 块间聚合边
    level0_edges: list[EdgeModel] = []
    seen0: dict[tuple[str, str], int] = {}
    block_in: dict[str, int] = {}
    block_out: dict[str, int] = {}
    for edge in file_edges:
        source_block = assignment.get(edge.source)
        target_block = assignment.get(edge.target)
        if source_block is None or target_block is None:
            continue
        if source_block == target_block:
            continue
        key = (source_block, target_block)
        seen0[key] = seen0.get(key, 0) + 1
    for (source_block, target_block), weight in seen0.items():
        level0_edges.append(
            EdgeModel(
                source=f"{BLOCK_PREFIX}{source_block}",
                target=f"{BLOCK_PREFIX}{target_block}",
                level=0,
                weight=weight,
            )
        )
        block_out[source_block] = block_out.get(source_block, 0) + 1
        block_in[target_block] = block_in.get(target_block, 0) + 1

    # L1 文件节点
    files_by_path = {meta.rel_path: meta for meta in files}
    level1_nodes: list[NodeModel] = []
    for node in file_nodes:
        block_id = assignment.get(node.file_path, OTHER_BLOCK_ID)
        symbols = []
        meta = files_by_path.get(node.file_path)
        if meta is not None:
            symbols = list(meta.functions) + list(meta.classes)
        isolated = (
            in_deg.get(node.file_path, 0) == 0
            and out_deg.get(node.file_path, 0) == 0
        ) or node.file_path in mapping_isolated
        level1_nodes.append(
            node.model_copy(
                update={
                    "level": 1,
                    "kind": "file",
                    "parent_id": f"{BLOCK_PREFIX}{block_id}",
                    "member_count": len(symbols),
                    "is_isolated": isolated,
                }
            )
        )

    # L2 原子功能节点（顶层函数 + 类）
    level2_nodes: list[NodeModel] = []
    for node in file_nodes:
        meta = files_by_path.get(node.file_path)
        if meta is None:
            continue
        for symbol in list(meta.functions) + list(meta.classes):
            level2_nodes.append(
                NodeModel(
                    id=f"{node.file_path}::{symbol}",
                    label=symbol,
                    file_path=node.file_path,
                    absolute_path=node.absolute_path,
                    last_commit_time=node.last_commit_time,
                    last_commit_hash=node.last_commit_hash,
                    last_commit_message=node.last_commit_message,
                    status=node.status,
                    module_name=node.module_name,
                    functions=[symbol],
                    is_isolated=False,
                    group=node.group,
                    files=[node.file_path],
                    level=2,
                    parent_id=node.file_path,
                    kind="atomic",
                    member_count=1,
                )
            )

    # L0 块节点
    files_by_block: dict[str, list[NodeModel]] = {}
    for node in level1_nodes:
        block_id = assignment.get(node.file_path, OTHER_BLOCK_ID)
        files_by_block.setdefault(block_id, []).append(node)

    level0_nodes: list[NodeModel] = []
    for block_id in sorted(files_by_block):
        members = files_by_block[block_id]
        latest = _latest(members)
        all_files: list[str] = []
        all_functions: list[str] = []
        seen_fn: set[str] = set()
        for member in members:
            all_files.append(member.file_path)
            for name in member.functions:
                if name not in seen_fn:
                    seen_fn.add(name)
                    all_functions.append(name)
        isolated = (
            block_in.get(block_id, 0) == 0 and block_out.get(block_id, 0) == 0
        )
        level0_nodes.append(
            NodeModel(
                id=f"{BLOCK_PREFIX}{block_id}",
                label=block_names.get(block_id, block_id),
                file_path=f"{BLOCK_PREFIX}{block_id}",
                absolute_path="",
                last_commit_time=latest.last_commit_time if latest else None,
                last_commit_hash=latest.last_commit_hash if latest else None,
                last_commit_message=latest.last_commit_message if latest else None,
                status=latest.status if latest else "uncommitted",
                module_name="",
                functions=all_functions,
                is_isolated=isolated,
                group=block_id,
                files=sorted(all_files),
                level=0,
                parent_id=None,
                kind="block",
                member_count=len(members),
            )
        )

    nodes = level0_nodes + level1_nodes + level2_nodes
    edges = level0_edges + level1_edges
    return nodes, edges
