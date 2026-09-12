from app.scanner.project_scanner import scan_python_files


def test_skips_dot_directories(tmp_path):
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "__init__.py").write_text("", encoding="utf-8")
    (tmp_path / "app" / "a.py").write_text("x = 1\n", encoding="utf-8")
    (tmp_path / ".trae").mkdir()
    (tmp_path / ".trae" / "b.py").write_text("y = 1\n", encoding="utf-8")
    (tmp_path / ".opencode").mkdir()
    (tmp_path / ".opencode" / "c.py").write_text("z = 1\n", encoding="utf-8")

    files, skipped, warnings = scan_python_files(tmp_path)
    rels = {f.rel_path for f in files}
    assert "app/a.py" in rels
    assert "app/__init__.py" in rels
    assert not any(part.startswith(".") for rel in rels for part in rel.split("/"))
    assert skipped == 0
    assert warnings == []
