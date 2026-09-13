from app.models.schemas import ScanResponse, ScanStats
from app.services import project_store


def _response(path: str, nodes: int, edges: int) -> ScanResponse:
    return ScanResponse(
        project_path=path,
        generated_at="2026-09-13T00:00:00+00:00",
        nodes=[],
        edges=[],
        stats=ScanStats(
            files_scanned=nodes,
            files_skipped=0,
            node_count=nodes,
            edge_count=edges,
        ),
        warnings=[],
    )


def test_save_list_get_delete(tmp_path, isolated_db):
    saved = project_store.save_project(str(tmp_path), _response(str(tmp_path), 2, 1))
    assert saved["id"] > 0
    assert saved["name"] == tmp_path.name

    projects = project_store.list_projects()
    assert [p["id"] for p in projects] == [saved["id"]]

    payload = project_store.get_blueprint(saved["id"])
    assert payload is not None
    assert payload["project_path"] == str(tmp_path)

    assert project_store.delete_project(saved["id"]) is True
    assert project_store.get_blueprint(saved["id"]) is None
    assert project_store.delete_project(saved["id"]) is False


def test_positions_roundtrip(tmp_path, isolated_db):
    saved = project_store.save_project(str(tmp_path), _response(str(tmp_path), 1, 0))
    project_store.save_positions(
        saved["id"], {"a": {"x": 1.5, "y": 2.5}, "b": {"x": 3, "y": 4}}
    )
    positions = project_store.get_positions(saved["id"])
    assert positions["a"] == {"x": 1.5, "y": 2.5}
    assert positions["b"] == {"x": 3.0, "y": 4.0}

    project_store.save_positions(saved["id"], {"a": {"x": 9, "y": 9}})
    assert project_store.get_positions(saved["id"])["a"] == {"x": 9.0, "y": 9.0}


def test_upsert_same_root_path(tmp_path, isolated_db):
    first = project_store.save_project(str(tmp_path), _response(str(tmp_path), 2, 1))
    second = project_store.save_project(str(tmp_path), _response(str(tmp_path), 5, 9))
    assert first["id"] == second["id"]
    assert second["node_count"] == 5
    assert second["edge_count"] == 9
    assert len(project_store.list_projects()) == 1
