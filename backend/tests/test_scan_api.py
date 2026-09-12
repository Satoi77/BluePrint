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
        "/api/blueprint/scan", json={"project_path": str(repo)}
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
