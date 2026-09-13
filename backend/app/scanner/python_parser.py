import ast
from typing import Optional

from app.models.schemas import ImportRef


def parse_python(
    source: bytes, rel_path: str
) -> tuple[list[ImportRef], list[str], list[str]]:
    """解析单个 Python 源文件的 import、顶层函数名与顶层类名。

    传入原始字节，交由 ast 自动识别 PEP 263 编码声明。
    """
    tree = ast.parse(source, filename=rel_path)
    imports: list[ImportRef] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(
                    ImportRef(
                        kind="import",
                        module=alias.name,
                        names=[alias.name],
                        level=0,
                        lineno=node.lineno,
                        asnames=[alias.asname],
                    )
                )
        elif isinstance(node, ast.ImportFrom):
            imports.append(
                ImportRef(
                    kind="from",
                    module=node.module,
                    names=[alias.name for alias in node.names],
                    level=node.level,
                    lineno=node.lineno,
                    asnames=[alias.asname for alias in node.names],
                )
            )
    functions = [
        node.name
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    classes = [node.name for node in tree.body if isinstance(node, ast.ClassDef)]
    return imports, functions, classes


def extract_calls(source: bytes) -> dict[str, list[tuple[Optional[str], str]]]:
    """提取每个顶层函数/类体内的调用：`f()` → (None, "f")；`m.f()` → ("m", "f")。

    用于构建原子功能之间的调用关系（机械分析，不做语义判断）。
    """
    tree = ast.parse(source)
    calls: dict[str, list[tuple[Optional[str], str]]] = {}
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        collected: list[tuple[Optional[str], str]] = []
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            func = child.func
            if isinstance(func, ast.Name):
                collected.append((None, func.id))
            elif isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
                collected.append((func.value.id, func.attr))
        calls[node.name] = collected
    return calls
