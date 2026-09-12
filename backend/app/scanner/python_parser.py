import ast

from app.models.schemas import ImportRef


def parse_python(source: bytes, rel_path: str) -> tuple[list[ImportRef], list[str]]:
    """解析单个 Python 源文件的 import 与顶层函数名。

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
                )
            )
    functions = [
        node.name
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    return imports, functions
