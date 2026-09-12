from datetime import datetime, timedelta, timezone

from app.models.schemas import CommitInfo, FileMeta, ImportRef
from app.scanner.blueprint_builder import build_blueprint


def make(
    rel: str,
    imports: list[ImportRef] | None = None,
    is_package: bool = False,
    module: str | None = None,
) -> FileMeta:
    if module is None:
        if rel.endswith("__init__.py"):
            module = rel[: -len("__init__.py")].rstrip("/").replace("/", ".")
        else:
            module = rel[:-3].replace("/", ".")
    return FileMeta(
        rel_path=rel,
        abs_path="/abs/" + rel,
        module_dotted=module,
        is_package=is_package,
        imports=imports or [],
        functions=[],
    )


def test_absolute_and_relative_resolution():
    a = make("pkg/a.py", [ImportRef("from", "pkg.b", ["helper"], 0, 1)])
    b = make("pkg/b.py")
    c = make("pkg/__init__.py", [ImportRef("from", None, ["a"], 1, 1)], is_package=True)

    _, edges = build_blueprint(
        [a, b, c], {}, 7, datetime.now(timezone.utc)
    )
    pairs = {(edge.source, edge.target) for edge in edges}
    assert ("pkg/a.py", "pkg/b.py") in pairs
    assert ("pkg/__init__.py", "pkg/a.py") in pairs


def test_import_package_root():
    a = make("a.py", [ImportRef("import", "pkg.mod", ["pkg.mod"], 0, 1)])
    pkg_init = make("pkg/__init__.py", is_package=True)
    mod = make("pkg/mod.py")
    _, edges = build_blueprint(
        [a, pkg_init, mod], {}, 7, datetime.now(timezone.utc)
    )
    assert ("a.py", "pkg/mod.py") in {(e.source, e.target) for e in edges}


def test_status_recent_old_uncommitted():
    now = datetime(2026, 9, 13, tzinfo=timezone.utc)
    files = [make("recent.py"), make("old.py"), make("new.py")]
    history = {
        "recent.py": CommitInfo("h1", (now - timedelta(days=2)).isoformat(), "r"),
        "old.py": CommitInfo("h2", (now - timedelta(days=30)).isoformat(), "o"),
    }
    nodes, _ = build_blueprint(files, history, 7, now)
    statuses = {node.file_path: node.status for node in nodes}
    assert statuses["recent.py"] == "recent"
    assert statuses["old.py"] == "old"
    assert statuses["new.py"] == "uncommitted"


def test_third_party_dropped_and_self_loop_dropped():
    a = make(
        "a.py",
        [
            ImportRef("import", "requests", ["requests"], 0, 1),
            ImportRef("import", "a", ["a"], 0, 2),
        ],
    )
    nodes, edges = build_blueprint([a], {}, 7, datetime.now(timezone.utc))
    assert edges == []
    assert nodes[0].is_isolated is True


def test_duplicate_module_picks_shortest_path():
    x = make("x.py", [ImportRef("import", "util", ["util"], 0, 1)], module="x")
    short = make("util.py", module="util")
    deep = make("deep/util.py", module="util")
    _, edges = build_blueprint(
        [x, short, deep], {}, 7, datetime.now(timezone.utc)
    )
    assert ("x.py", "util.py") in {(e.source, e.target) for e in edges}


def test_relative_parent_import():
    sub = make("pkg/sub/mod.py", [ImportRef("from", "util", ["helper"], 2, 1)])
    util = make("pkg/util.py")
    _, edges = build_blueprint(
        [sub, util], {}, 7, datetime.now(timezone.utc)
    )
    assert ("pkg/sub/mod.py", "pkg/util.py") in {(e.source, e.target) for e in edges}


def test_suffix_match_when_scan_root_has_prefix():
    owner = make(
        "backend/app/services/x.py",
        [ImportRef("from", "app.services.y", ["helper"], 0, 1)],
        module="backend.app.services.x",
    )
    target = make("backend/app/services/y.py", module="backend.app.services.y")
    _, edges = build_blueprint(
        [owner, target], {}, 7, datetime.now(timezone.utc)
    )
    assert ("backend/app/services/x.py", "backend/app/services/y.py") in {
        (e.source, e.target) for e in edges
    }


def test_single_segment_import_not_suffix_matched():
    owner = make(
        "backend/app/x.py",
        [ImportRef("import", "logging", ["logging"], 0, 1)],
        module="backend.app.x",
    )
    target = make("backend/app/logging.py", module="backend.app.logging")
    _, edges = build_blueprint(
        [owner, target], {}, 7, datetime.now(timezone.utc)
    )
    assert edges == []
