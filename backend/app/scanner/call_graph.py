from typing import Optional

from app.models.schemas import FileMeta

AliasTarget = tuple[str, str, Optional[str]]  # (kind, file_path, symbol)


def _module_index(files: list[FileMeta]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for file in files:
        index.setdefault(file.module_dotted, []).append(file.rel_path)
    return index


def _lookup_module(name: str, index: dict[str, list[str]]) -> Optional[str]:
    if name in index:
        return sorted(index[name], key=len)[0]
    if "." in name:
        suffix = "." + name
        paths = [
            path
            for module, module_paths in index.items()
            if module.endswith(suffix)
            for path in module_paths
        ]
        if paths:
            return sorted(paths, key=len)[0]
    return None


def _alias_map(
    files: list[FileMeta], index: dict[str, list[str]]
) -> dict[str, dict[str, AliasTarget]]:
    """每个文件内 `别名 -> 目标（模块文件或符号）` 的映射。"""
    result: dict[str, dict[str, AliasTarget]] = {}
    for file in files:
        aliases: dict[str, AliasTarget] = {}
        for ref in file.imports:
            if ref.level > 0:
                continue
            if ref.kind == "import" and ref.module:
                alias = (
                    ref.asnames[0]
                    if ref.asnames and ref.asnames[0]
                    else ref.module.split(".")[0]
                )
                target = _lookup_module(ref.module, index)
                if target:
                    aliases[alias] = ("module", target, None)
                if "." in ref.module:
                    top = ref.module.split(".")[0]
                    top_target = _lookup_module(top, index)
                    if top_target and top not in aliases:
                        aliases[top] = ("module", top_target, None)
            elif ref.kind == "from":
                base = ref.module or ""
                base_file = _lookup_module(base, index) if base else None
                asnames = ref.asnames or [None] * len(ref.names)
                for name, asname in zip(ref.names, asnames):
                    if name == "*":
                        continue
                    alias = asname or name
                    sub = f"{base}.{name}" if base else name
                    sub_file = _lookup_module(sub, index)
                    if sub_file:
                        aliases[alias] = ("module", sub_file, None)
                    elif base_file:
                        aliases[alias] = ("symbol", base_file, name)
        result[file.rel_path] = aliases
    return result


def build_call_edges(
    files: list[FileMeta],
) -> list[tuple[str, str, str, str]]:
    """返回原子级调用边：(调用方文件, 调用方符号, 被调用文件, 被调用符号)。

    机械分析：同文件调用、`from m import f` 后调用 f、`import m` 后调用 m.f。
    """
    index = _module_index(files)
    aliases = _alias_map(files, index)
    symbols_by_file = {
        file.rel_path: set(file.functions) | set(file.classes) for file in files
    }

    edges: list[tuple[str, str, str, str]] = []
    seen: set[tuple[str, str, str, str]] = set()

    for file in files:
        known = symbols_by_file.get(file.rel_path, set())
        for caller, calls in file.calls.items():
            if caller not in known:
                continue
            for base, name in calls:
                target: Optional[tuple[str, str]] = None
                if base is None:
                    if name in known:
                        target = (file.rel_path, name)
                    else:
                        info = aliases.get(file.rel_path, {}).get(name)
                        if info and info[0] == "symbol":
                            target = (info[1], info[2] or name)
                else:
                    info = aliases.get(file.rel_path, {}).get(base)
                    if info and info[0] == "module":
                        if name in symbols_by_file.get(info[1], set()):
                            target = (info[1], name)
                    elif info and info[0] == "symbol":
                        if name == info[2]:
                            target = (info[1], info[2] or name)
                    else:
                        module_file = _lookup_module(base, index)
                        if module_file and name in symbols_by_file.get(
                            module_file, set()
                        ):
                            target = (module_file, name)

                if target is None:
                    continue
                if target[0] == file.rel_path and target[1] == caller:
                    continue
                key = (file.rel_path, caller, target[0], target[1])
                if key in seen:
                    continue
                seen.add(key)
                edges.append(key)

    return edges
