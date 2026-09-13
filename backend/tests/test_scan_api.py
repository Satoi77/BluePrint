import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated(isolated_db):
    return isolated_db


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_path_not_exist(tmp_path):
    response = client.post(
        "/api/blueprint/scan", json={"project_path": str(tmp_path / "missing")}
    )
    assert response.status_code == 400
    assert "不存在" in response.json()["detail"]


def test_not_a_directory(tmp_path):
    file = tmp_path / "file.txt"
    file.write_text("x", encoding="utf-8")
    response = client.post(
        "/api/blueprint/scan", json={"project_path": str(file)}
    )
    assert response.status_code == 400
    assert "不是目录" in response.json()["detail"]


def test_no_git_directory(tmp_path):
    response = client.post(
        "/api/blueprint/scan", json={"project_path": str(tmp_path)}
    )
    assert response.status_code == 400
    assert ".git" in response.json()["detail"]


def test_missing_project_path():
    response = client.post("/api/blueprint/scan", json={})
    assert response.status_code == 422


def test_scan_happy_path(repo, git):
    (repo / "a.py").write_text("from b import helper\n", encoding="utf-8")
    (repo / "b.py").write_text("def helper():\n    pass\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")

    response = client.post(
        "/api/blueprint/scan",
        json={"project_path": str(repo), "granularity": "file"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stats"]["node_count"] == 2
    assert any(
        edge["source"] == "a.py" and edge["target"] == "b.py"
        for edge in data["edges"]
    )
    node_a = next(node for node in data["nodes"] if node["file_path"] == "a.py")
    assert node_a["status"] == "recent"
    assert node_a["last_commit_message"] == "init"
    assert node_a["functions"] == []


def test_scan_function_granularity(repo, git):
    (repo / "pkg1").mkdir()
    (repo / "pkg1" / "a.py").write_text(
        "from pkg2.b import helper\n", encoding="utf-8"
    )
    (repo / "pkg2").mkdir()
    (repo / "pkg2" / "b.py").write_text(
        "def helper():\n    pass\n", encoding="utf-8"
    )
    git("add", ".")
    git("commit", "-m", "init")

    response = client.post(
        "/api/blueprint/scan", json={"project_path": str(repo)}
    )
    assert response.status_code == 200
    data = response.json()

    blocks = {n["id"] for n in data["nodes"] if n["kind"] == "block"}
    files = {n["id"] for n in data["nodes"] if n["kind"] == "file"}
    atomics = {n["id"] for n in data["nodes"] if n["kind"] == "atomic"}

    assert blocks == {"block:pkg1", "block:pkg2"}
    assert files == {"pkg1/a.py", "pkg2/b.py"}
    assert "pkg2/b.py::helper" in atomics
    assert any(
        e["source"] == "block:pkg1"
        and e["target"] == "block:pkg2"
        and e["level"] == 0
        for e in data["edges"]
    )
    assert any(
        e["source"] == "pkg1/a.py"
        and e["target"] == "pkg2/b.py"
        and e["level"] == 1
        for e in data["edges"]
    )


def test_scan_persists_and_lists_project(repo, git):
    (repo / "a.py").write_text("x = 1\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")

    scan = client.post("/api/blueprint/scan", json={"project_path": str(repo)})
    assert scan.status_code == 200
    project_id = scan.json()["project_id"]
    assert project_id

    projects = client.get("/api/projects").json()
    assert any(p["id"] == project_id for p in projects)

    loaded = client.get(f"/api/projects/{project_id}/blueprint")
    assert loaded.status_code == 200
    assert loaded.json()["project_id"] == project_id

    assert client.delete(f"/api/projects/{project_id}").status_code == 200
    assert client.get(f"/api/projects/{project_id}/blueprint").status_code == 404


def test_blueprint_edit_and_export(repo, git):
    (repo / "pkg").mkdir()
    (repo / "pkg" / "a.py").write_text("def f():\n    pass\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")

    project_id = client.post(
        "/api/blueprint/scan", json={"project_path": str(repo)}
    ).json()["project_id"]

    blueprint = {
        "functions": [
            {
                "id": "main",
                "name": "主功能",
                "level": 0,
                "parent": None,
                "kind": "block",
                "files": ["pkg/a.py"],
            },
            {
                "id": "main.sub",
                "name": "子功能",
                "level": 1,
                "parent": "main",
                "kind": "group",
                "files": ["pkg/a.py"],
            },
        ],
        "edges": [],
    }
    assert (
        client.post(
            f"/api/projects/{project_id}/blueprint", json=blueprint
        ).status_code
        == 200
    )

    source = client.get(
        f"/api/projects/{project_id}/blueprint/source"
    ).json()
    assert any(item["id"] == "main" for item in source["functions"])

    added = client.post(
        f"/api/projects/{project_id}/blueprint/functions",
        json={
            "id": "main.sub.atomic",
            "name": "原子",
            "level": 2,
            "parent": "main.sub",
            "kind": "atomic",
            "files": ["pkg/a.py"],
        },
    )
    assert added.status_code == 200

    updated = client.post(
        f"/api/projects/{project_id}/blueprint/functions/update",
        json={
            "id": "main.sub.atomic",
            "name": "原子2",
            "level": 2,
            "parent": "main.sub",
            "kind": "atomic",
            "files": ["pkg/a.py"],
        },
    )
    assert updated.status_code == 200

    edge = client.post(
        f"/api/projects/{project_id}/blueprint/edges/add",
        json={"source": "main", "target": "main.sub", "type": "call"},
    )
    assert edge.status_code == 200

    deleted = client.post(
        f"/api/projects/{project_id}/blueprint/functions/delete",
        json={"id": "main.sub.atomic"},
    )
    assert deleted.status_code == 200

    exported = client.get(f"/api/projects/{project_id}/blueprint/export")
    assert exported.status_code == 200
    assert "功能结构化说明" in exported.text


def test_create_blank_project_and_edit_offline():
    created = client.post(
        "/api/projects", json={"name": "设计稿", "root_path": "D:/design/demo"}
    )
    assert created.status_code == 200
    project_id = created.json()["id"]

    source = client.get(f"/api/projects/{project_id}/blueprint/source")
    assert source.status_code == 200
    assert source.json()["functions"] == []

    rendered = client.get(f"/api/projects/{project_id}/blueprint")
    assert rendered.status_code == 200
    assert rendered.json()["nodes"] == []

    added = client.post(
        f"/api/projects/{project_id}/blueprint/functions",
        json={
            "id": "root",
            "name": "主功能",
            "level": 0,
            "parent": None,
            "kind": "block",
            "files": [],
            "symbols": [],
        },
    )
    assert added.status_code == 200
    assert any(node["id"] == "root" for node in added.json()["nodes"])

    client.post(
        f"/api/projects/{project_id}/blueprint/functions",
        json={
            "id": "root.sub",
            "name": "子功能",
            "level": 1,
            "parent": "root",
            "kind": "group",
            "files": [],
            "symbols": [],
        },
    )
    edge = client.post(
        f"/api/projects/{project_id}/blueprint/edges/add",
        json={"source": "root", "target": "root.sub", "type": "manual"},
    )
    assert edge.status_code == 200
    assert any(
        item["source"] == "root" and item["target"] == "root.sub"
        for item in edge.json()["edges"]
    )

    assert client.delete(f"/api/projects/{project_id}").status_code == 200


def test_bad_file_does_not_abort(repo, git):
    (repo / "good.py").write_text("x = 1\n", encoding="utf-8")
    (repo / "bad.py").write_text("def (:\n", encoding="utf-8")
    git("add", ".")
    git("commit", "-m", "init")

    response = client.post(
        "/api/blueprint/scan", json={"project_path": str(repo)}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["stats"]["files_scanned"] == 1
    assert data["stats"]["files_skipped"] == 1
    assert len(data["warnings"]) == 1
