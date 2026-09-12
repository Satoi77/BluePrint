from app.models.schemas import EdgeModel, FileMeta, NodeModel
from app.scanner.hierarchy import build_function_hierarchy


def make_file(rel, functions=(), classes=()):
    if rel.endswith("__init__.py"):
        module = rel[: -len("__init__.py")].rstrip("/").replace("/", ".")
    else:
        module = rel[:-3].replace("/", ".")
    return FileMeta(
        rel_path=rel,
        abs_path="/abs/" + rel,
        module_dotted=module,
        is_package=False,
        imports=[],
        functions=list(functions),
        classes=list(classes),
    )


def make_node(rel, status="recent", functions=()):
    return NodeModel(
        id=rel,
        label=rel.split("/")[-1],
        file_path=rel,
        absolute_path="/abs/" + rel,
        status=status,
        module_name="",
        functions=list(functions),
        files=[],
    )


def test_hierarchy_with_mapping():
    files = [
        make_file("a/x.py", functions=["f1"]),
        make_file("b/y.py", functions=["f2"]),
        make_file("z.py"),
    ]
    nodes = [make_node("a/x.py"), make_node("b/y.py"), make_node("z.py")]
    edges = [EdgeModel(source="a/x.py", target="b/y.py")]
    mapping = {
        "blocks": [
            {"id": "write", "name": "写正文", "files": ["a/x.py"]},
            {"id": "audit", "name": "审核", "files": ["b/y.py"]},
        ],
        "isolated": ["z.py"],
    }

    hn, he = build_function_hierarchy(files, nodes, edges, mapping)
    by_id = {node.id: node for node in hn}

    assert by_id["block:write"].label == "写正文"
    assert by_id["block:write"].level == 0
    assert by_id["a/x.py"].parent_id == "block:write"
    assert by_id["a/x.py::f1"].kind == "atomic"
    assert by_id["a/x.py::f1"].level == 2
    assert by_id["z.py"].parent_id == "block:other"
    assert by_id["z.py"].is_isolated is True

    assert any(
        edge.source == "block:write"
        and edge.target == "block:audit"
        and edge.level == 0
        for edge in he
    )
    assert any(
        edge.source == "a/x.py" and edge.target == "b/y.py" and edge.level == 1
        for edge in he
    )


def test_hierarchy_fallback_by_directory():
    files = [make_file("pkg/a.py"), make_file("pkg/b.py")]
    nodes = [make_node("pkg/a.py"), make_node("pkg/b.py")]
    edges = [EdgeModel(source="pkg/a.py", target="pkg/b.py")]

    hn, he = build_function_hierarchy(files, nodes, edges, None)
    by_id = {node.id: node for node in hn}

    assert by_id["block:pkg"].level == 0
    assert by_id["pkg/a.py"].parent_id == "block:pkg"
    assert not any(edge.level == 0 for edge in he)
