import os
from pathlib import Path

from app.config import IGNORE_DIRS
from app.models.schemas import FileMeta
from app.scanner.python_parser import parse_python


def compute_module_dotted(rel_posix: str) -> tuple[str, bool]:
    """由相对路径推导点分模块名，并标记是否为包（__init__.py）。"""
    parts = rel_posix.split("/")
    is_package = parts[-1] == "__init__.py"
    if is_package:
        parts = parts[:-1]
    else:
        parts[-1] = parts[-1][:-3]
    return ".".join(parts), is_package


def scan_python_files(root: Path) -> tuple[list[FileMeta], int, list[str]]:
    """递归扫描目录下的 .py 文件。

    单个文件解析失败时跳过并记录警告，不中断整体扫描。
    返回 (files, skipped_count, warnings)。
    """
    files: list[FileMeta] = []
    skipped = 0
    warnings: list[str] = []

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for filename in filenames:
            if not filename.endswith(".py"):
                continue
            abs_path = Path(dirpath) / filename
            try:
                rel_path = abs_path.relative_to(root).as_posix()
            except ValueError:
                continue
            try:
                source = abs_path.read_bytes()
                imports, functions = parse_python(source, rel_path)
            except (SyntaxError, ValueError, UnicodeDecodeError, OSError) as exc:
                skipped += 1
                message = f"跳过无法解析的文件 {rel_path}: {type(exc).__name__}: {exc}"
                warnings.append(message)
                continue
            module_dotted, is_package = compute_module_dotted(rel_path)
            files.append(
                FileMeta(
                    rel_path=rel_path,
                    abs_path=str(abs_path.resolve()),
                    module_dotted=module_dotted,
                    is_package=is_package,
                    imports=imports,
                    functions=functions,
                )
            )

    return files, skipped, warnings
