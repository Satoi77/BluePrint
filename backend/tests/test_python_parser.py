import pytest

from app.scanner.python_parser import parse_python


def test_absolute_import():
    imports, _, _ = parse_python(b"import a.b\nfrom c.d import e, f\n", "x.py")
    assert imports[0].kind == "import"
    assert imports[0].module == "a.b"
    assert imports[0].names == ["a.b"]
    assert imports[0].level == 0
    assert imports[1].kind == "from"
    assert imports[1].module == "c.d"
    assert imports[1].names == ["e", "f"]


def test_relative_import():
    imports, _, _ = parse_python(
        b"from . import x\nfrom ..pkg import y\nfrom .mod import z\n", "pkg/sub/mod.py"
    )
    assert imports[0].level == 1
    assert imports[0].module is None
    assert imports[0].names == ["x"]
    assert imports[1].level == 2
    assert imports[1].module == "pkg"
    assert imports[2].level == 1
    assert imports[2].module == "mod"


def test_functions_and_classes_top_level_only():
    source = (
        b"def a():\n"
        b"    pass\n"
        b"async def b():\n"
        b"    pass\n"
        b"class C:\n"
        b"    def m(self):\n"
        b"        pass\n"
        b"class D:\n"
        b"    pass\n"
    )
    _, functions, classes = parse_python(source, "x.py")
    assert functions == ["a", "b"]
    assert classes == ["C", "D"]


def test_encoding_cookie():
    imports, _, _ = parse_python(
        "# -*- coding: gbk -*-\nimport a\n".encode("gbk"), "x.py"
    )
    assert imports[0].module == "a"


def test_syntax_error_raises():
    with pytest.raises(SyntaxError):
        parse_python(b"def (:\n", "bad.py")
