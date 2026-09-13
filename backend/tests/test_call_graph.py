from app.models.schemas import FileMeta, ImportRef
from app.scanner.call_graph import build_call_edges
from app.scanner.python_parser import extract_calls


def make_file(rel, functions, imports=(), calls=None, module=None):
    return FileMeta(
        rel_path=rel,
        abs_path="/abs/" + rel,
        module_dotted=module or rel[:-3].replace("/", "."),
        is_package=False,
        imports=list(imports),
        functions=list(functions),
        classes=[],
        calls=calls or {},
    )


def test_extract_calls():
    calls = extract_calls(b"def a():\n    b()\n    m.c()\n")
    assert (None, "b") in calls["a"]
    assert ("m", "c") in calls["a"]


def test_same_file_call_edge():
    file = make_file("pkg/a.py", ["a", "b"], calls={"a": [(None, "b")]})
    assert ("pkg/a.py", "a", "pkg/a.py", "b") in build_call_edges([file])


def test_imported_symbol_call_edge():
    a = make_file(
        "pkg/a.py",
        ["run"],
        imports=[ImportRef("from", "pkg.b", ["helper"], 0, 1, ["helper"])],
        calls={"run": [(None, "helper")]},
    )
    b = make_file("pkg/b.py", ["helper"])
    edges = build_call_edges([a, b])
    assert ("pkg/a.py", "run", "pkg/b.py", "helper") in edges


def test_module_attribute_call_edge():
    a = make_file(
        "pkg/a.py",
        ["run"],
        imports=[ImportRef("import", "pkg.b", ["pkg.b"], 0, 1, [None])],
        calls={"run": [("pkg", "helper")]},
    )
    b = make_file("pkg/b.py", ["helper"])
    edges = build_call_edges([a, b])
    assert ("pkg/a.py", "run", "pkg/b.py", "helper") in edges
