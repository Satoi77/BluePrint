import json
from typing import Any, Optional

_KIND_BY_LEVEL = {0: "block", 1: "group", 2: "atomic"}


def _functions(bp: dict) -> list[dict]:
    return bp.setdefault("functions", [])


def _edges(bp: dict) -> list[dict]:
    return bp.setdefault("edges", [])


def find_function(bp: dict, function_id: str) -> Optional[dict]:
    return next(
        (item for item in _functions(bp) if item.get("id") == function_id), None
    )


def _function_ids(bp: dict) -> set[str]:
    return {item.get("id") for item in _functions(bp) if item.get("id")}


def add_function(bp: dict, function: dict) -> None:
    fid = function.get("id")
    if not fid:
        raise ValueError("缺少 id")
    if find_function(bp, fid) is not None:
        raise ValueError(f"功能 id 已存在: {fid}")
    level = int(function.get("level", 2))
    function.setdefault("kind", _KIND_BY_LEVEL.get(level, "atomic"))
    function.setdefault("parent", None)
    function.setdefault("files", [])
    function.setdefault("isolated", False)
    parent = function.get("parent")
    if parent is not None and find_function(bp, parent) is None:
        raise ValueError(f"父功能不存在: {parent}")
    _functions(bp).append(function)


def update_function(bp: dict, function: dict) -> None:
    fid = function.get("id")
    functions = _functions(bp)
    for index, item in enumerate(functions):
        if item.get("id") == fid:
            parent = function.get("parent")
            if parent is not None and find_function(bp, parent) is None:
                raise ValueError(f"父功能不存在: {parent}")
            functions[index] = function
            return
    raise ValueError(f"功能不存在: {fid}")


def delete_function(bp: dict, function_id: str) -> set[str]:
    """删除功能及其所有后代，并清理相关边。返回被删除的 id 集合。"""
    functions = _functions(bp)
    if find_function(bp, function_id) is None:
        raise ValueError(f"功能不存在: {function_id}")
    doomed: set[str] = {function_id}
    changed = True
    while changed:
        changed = False
        for item in functions:
            if item.get("parent") in doomed and item.get("id") not in doomed:
                doomed.add(item["id"])
                changed = True
    bp["functions"] = [
        item for item in functions if item.get("id") not in doomed
    ]
    bp["edges"] = [
        edge
        for edge in _edges(bp)
        if edge.get("source") not in doomed and edge.get("target") not in doomed
    ]
    return doomed


def add_edge(bp: dict, edge: dict) -> None:
    source = edge.get("source")
    target = edge.get("target")
    if not source or not target:
        raise ValueError("缺少 source/target")
    ids = _function_ids(bp)
    if source not in ids or target not in ids:
        raise ValueError("边的端点不存在")
    if source == target:
        raise ValueError("不能连接自身")
    edges = _edges(bp)
    if any(
        item.get("source") == source and item.get("target") == target
        for item in edges
    ):
        return
    edges.append(
        {
            "source": source,
            "target": target,
            "type": edge.get("type") or "manual",
            "label": edge.get("label") or "",
        }
    )


def delete_edge(bp: dict, source: str, target: str) -> None:
    bp["edges"] = [
        edge
        for edge in _edges(bp)
        if not (edge.get("source") == source and edge.get("target") == target)
    ]


def export_markdown(bp: dict, project_name: str, generated_at: str) -> str:
    """导出功能结构化说明（Markdown + 内嵌 JSON），供 Agent 据此改代码。"""
    functions = _functions(bp)
    ids = _function_ids(bp)
    children: dict[Any, list[dict]] = {}
    for item in functions:
        children.setdefault(item.get("parent"), []).append(item)

    lines: list[str] = []
    lines.append(f"# 功能结构化说明 — {project_name}")
    lines.append("")
    lines.append(f"> 由 BluePrint 导出（{generated_at}），供 Agent 据此修改代码。")
    lines.append("")

    lines.append("## 一、功能层级")
    lines.append("")
    visited: set[str] = set()

    def render(parent: Any, depth: int) -> None:
        for item in sorted(
            children.get(parent, []), key=lambda value: value.get("id", "")
        ):
            fid = item.get("id")
            if fid in visited:
                continue
            visited.add(fid)
            indent = "  " * depth
            tag = " · 孤立" if item.get("isolated") else ""
            lines.append(
                f"{indent}- **{item.get('name')}** (`{fid}`) "
                f"[{item.get('kind')}/L{item.get('level')}]{tag}"
            )
            if item.get("description"):
                lines.append(f"{indent}  - 说明：{item.get('description')}")
            if item.get("files"):
                lines.append(f"{indent}  - 文件：{', '.join(item['files'])}")
            if item.get("symbols"):
                lines.append(f"{indent}  - 符号：{', '.join(item['symbols'])}")
            render(fid, depth + 1)

    roots = [None]
    roots.extend(
        item.get("parent")
        for item in functions
        if item.get("parent") not in (None,) and item.get("parent") not in ids
    )
    for root in roots:
        render(root, 0)
    # 兜底：环或异常归属导致未被渲染的节点
    for item in functions:
        fid = item.get("id")
        if fid not in visited:
            lines.append(f"- **{item.get('name')}** (`{fid}`)")
            visited.add(fid)

    lines.append("")
    lines.append("## 二、功能关系")
    lines.append("")
    name_of = {item.get("id"): item.get("name") for item in functions}
    edges = _edges(bp)
    if not edges:
        lines.append("（无）")
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        label = f"：{edge.get('label')}" if edge.get("label") else ""
        lines.append(
            f"- {name_of.get(source, source)} → {name_of.get(target, target)}"
            f"（{edge.get('type') or 'relation'}{label}）"
        )

    lines.append("")
    lines.append("## 三、孤立功能")
    lines.append("")
    isolated = [item for item in functions if item.get("isolated")]
    if not isolated:
        lines.append("（无）")
    for item in isolated:
        lines.append(f"- {item.get('name')} (`{item.get('id')}`)")

    lines.append("")
    lines.append("## 四、原始蓝图（JSON，可重新导入 BluePrint）")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(bp, ensure_ascii=False, indent=2))
    lines.append("```")
    lines.append("")
    return "\n".join(lines)
