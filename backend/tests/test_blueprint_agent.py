from datetime import datetime, timezone

from app.models.schemas import CommitInfo, FileMeta, NodeModel
from app.scanner.blueprint_agent import (
    build_from_agent_blueprint,
    validate_agent_blueprint,
)


def make_file(rel: str) -> FileMeta:
    return FileMeta(
        rel_path=rel,
        abs_path="/abs/" + rel,
        module_dotted=rel[:-3].replace("/", "."),
        is_package=False,
    )


def make_node(rel: str, status: str = "recent", iso: str | None = None) -> NodeModel:
    return NodeModel(
        id=rel,
        label=rel,
        file_path=rel,
        absolute_path="",
        status=status,
        module_name="",
        last_commit_time=iso,
    )


def test_build_from_agent_blueprint():
    file_nodes = [
        make_node("a.py", "recent", "2026-09-12T00:00:00+00:00"),
        make_node("b.py", "old", "2026-08-01T00:00:00+00:00"),
    ]
    blueprint = {
        "functions": [
            {
                "id": "write",
                "name": "写正文",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["a.py"],
            },
            {
                "id": "write.gen",
                "name": "章节生成",
                "level": 1,
                "parent": "write",
                "kind": "group",
                "files": ["b.py"],
            },
            {
                "id": "settings",
                "name": "设置",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": [],
                "isolated": True,
            },
        ],
        "edges": [
            {"source": "write", "target": "write.gen", "type": "call", "label": "调用"}
        ],
    }

    nodes, edges = build_from_agent_blueprint(blueprint, file_nodes)
    by_id = {node.id: node for node in nodes}

    assert by_id["write"].label == "写正文"
    assert by_id["write"].level == 0
    assert by_id["write"].kind == "block"
    assert by_id["write"].status == "recent"
    assert by_id["write.gen"].parent_id == "write"
    assert by_id["settings"].is_isolated is True

    assert len(edges) == 1
    assert edges[0].source == "write"
    assert edges[0].level == 1
    assert edges[0].label == "调用"


def test_symbol_names_used_for_atomic_nodes():
    files = [
        FileMeta(
            rel_path="pkg/a.py",
            abs_path="/abs/pkg/a.py",
            module_dotted="pkg.a",
            is_package=False,
            functions=["load_chapters"],
        )
    ]
    file_nodes = [make_node("pkg/a.py")]
    blueprint = {
        "functions": [
            {
                "id": "write",
                "name": "写正文",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["pkg/a.py"],
            },
            {
                "id": "write.sub",
                "name": "章节",
                "level": 1,
                "parent": "write",
                "kind": "group",
                "files": ["pkg/a.py"],
            },
        ],
        "edges": [],
        "symbol_names": {"pkg/a.py::load_chapters": "加载正文内容"},
    }
    nodes, _ = build_from_agent_blueprint(blueprint, file_nodes, files)
    atomic = [node for node in nodes if node.level == 2]
    assert any(node.label == "加载正文内容" for node in atomic)


def test_non_python_symbols_generate_atomic_nodes():
    blueprint = {
        "functions": [
            {
                "id": "ui",
                "name": "前端界面",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["frontend/src/App.tsx"],
                "symbols": [],
            },
            {
                "id": "ui.canvas",
                "name": "画布",
                "level": 1,
                "parent": "ui",
                "kind": "group",
                "files": ["frontend/src/App.tsx"],
                "symbols": ["App", "renderCanvas"],
            },
        ],
        "edges": [],
        "symbol_names": {"frontend/src/App.tsx::App": "应用入口"},
    }
    nodes, _ = build_from_agent_blueprint(
        blueprint, [], None, None, 7, datetime.now(timezone.utc)
    )
    atomic = [node for node in nodes if node.level == 2]
    assert any(node.label == "应用入口" for node in atomic)
    assert any(node.functions == ["renderCanvas"] for node in atomic)


def test_status_from_history_for_non_python():
    now = datetime(2026, 9, 13, tzinfo=timezone.utc)
    blueprint = {
        "functions": [
            {
                "id": "ui",
                "name": "前端",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["frontend/src/App.tsx"],
            }
        ],
        "edges": [],
    }
    history = {
        "frontend/src/App.tsx": CommitInfo(
            "abc", "2026-09-12T00:00:00+00:00", "init"
        )
    }
    nodes, _ = build_from_agent_blueprint(blueprint, [], None, history, 7, now)
    assert nodes[0].status == "recent"
    assert nodes[0].last_commit_hash == "abc"


def test_validate_reports_uncovered_and_bad_parent():
    files = [make_file("a.py"), make_file("c.py")]
    blueprint = {
        "functions": [
            {
                "id": "write",
                "name": "写正文",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["a.py"],
            },
            {
                "id": "bad",
                "name": "坏节点",
                "level": 1,
                "parent": "nope",
                "kind": "group",
                "files": [],
            },
        ],
        "edges": [],
    }

    warnings = validate_agent_blueprint(blueprint, files)
    assert any("parent 不存在" in warning for warning in warnings)
    assert any("未被任何功能覆盖: c.py" in warning for warning in warnings)
