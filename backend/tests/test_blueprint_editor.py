import pytest

from app.services import blueprint_editor as be


def sample() -> dict:
    return {
        "functions": [
            {"id": "a", "name": "A", "level": 0, "parent": None, "kind": "block", "files": []},
            {"id": "a.b", "name": "B", "level": 1, "parent": "a", "kind": "group", "files": []},
            {"id": "a.b.c", "name": "C", "level": 2, "parent": "a.b", "kind": "atomic", "files": []},
            {"id": "x", "name": "X", "level": 0, "parent": None, "kind": "block", "files": []},
        ],
        "edges": [{"source": "a", "target": "x", "type": "workflow", "label": ""}],
    }


def test_add_update_and_cascade_delete():
    blueprint = sample()
    be.add_function(
        blueprint,
        {"id": "x.y", "name": "Y", "level": 1, "parent": "x", "kind": "group", "files": []},
    )
    assert be.find_function(blueprint, "x.y") is not None

    be.update_function(
        blueprint,
        {"id": "x.y", "name": "Y2", "level": 1, "parent": "x", "kind": "group", "files": ["f.py"]},
    )
    assert be.find_function(blueprint, "x.y")["name"] == "Y2"

    doomed = be.delete_function(blueprint, "a")
    assert doomed == {"a", "a.b", "a.b.c"}
    assert be.find_function(blueprint, "a") is None
    assert blueprint["edges"] == []


def test_edge_add_dedupe_delete():
    blueprint = sample()
    be.add_edge(blueprint, {"source": "x", "target": "a", "type": "manual", "label": "修"})
    be.add_edge(blueprint, {"source": "x", "target": "a"})
    matches = [e for e in blueprint["edges"] if e["source"] == "x" and e["target"] == "a"]
    assert len(matches) == 1

    be.delete_edge(blueprint, "x", "a")
    assert not any(
        e["source"] == "x" and e["target"] == "a" for e in blueprint["edges"]
    )


def test_export_markdown():
    markdown = be.export_markdown(sample(), "proj", "2026-09-13")
    assert "# 功能结构化说明 — proj" in markdown
    assert "**A**" in markdown
    assert "`a.b`" in markdown
    assert "```json" in markdown


def test_validation_errors():
    blueprint = sample()
    with pytest.raises(ValueError):
        be.add_function(blueprint, {"id": "a", "name": "dup"})
    with pytest.raises(ValueError):
        be.add_edge(blueprint, {"source": "a", "target": "missing"})
    with pytest.raises(ValueError):
        be.delete_function(blueprint, "missing")
