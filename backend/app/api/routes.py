from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from app.models.schemas import (
    LogExportRequest,
    ProjectModel,
    ScanRequest,
    ScanResponse,
)
from app.services.logging_db import export_csv, log, query_logs
from app.services import blueprint_editor
from app.services.project_store import (
    delete_project,
    get_blueprint,
    get_mapping,
    get_project,
    list_projects,
    save_mapping,
)
from app.services.scan_service import ScanError, scan_project

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@router.post("/blueprint/scan", response_model=ScanResponse)
def scan(request: ScanRequest) -> ScanResponse:
    try:
        return scan_project(
            request.project_path, request.name, request.granularity
        )
    except ScanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/projects", response_model=list[ProjectModel])
def get_projects() -> list[ProjectModel]:
    return [ProjectModel(**item) for item in list_projects()]


@router.get("/projects/{project_id}/blueprint")
def get_project_blueprint(project_id: int) -> dict:
    payload = get_blueprint(project_id)
    if payload is None:
        raise HTTPException(
            status_code=404, detail=f"项目不存在或尚未扫描: {project_id}"
        )
    payload["project_id"] = project_id
    return payload


@router.post("/projects/{project_id}/blueprint", response_model=ScanResponse)
def import_blueprint(project_id: int, blueprint: dict) -> ScanResponse:
    """导入 Agent 生成的功能蓝图并重新渲染。"""
    project = get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")
    if not blueprint.get("functions"):
        raise HTTPException(status_code=400, detail="蓝图缺少 functions 字段")
    save_mapping(project_id, blueprint)
    log("info", "api.routes", "导入功能蓝图", {"project_id": project_id})
    try:
        return scan_project(project["root_path"], project["name"], "function")
    except ScanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


def _require_project(project_id: int) -> dict:
    project = get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")
    return project


def _require_blueprint(project_id: int) -> dict:
    blueprint = get_mapping(project_id)
    if not blueprint or not blueprint.get("functions"):
        raise HTTPException(status_code=404, detail="该项目尚无功能蓝图")
    return blueprint


def _rebuild(project: dict) -> ScanResponse:
    try:
        return scan_project(project["root_path"], project["name"], "function")
    except ScanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/projects/{project_id}/blueprint/source")
def get_project_blueprint_raw(project_id: int) -> dict:
    _require_project(project_id)
    return _require_blueprint(project_id)


@router.post("/projects/{project_id}/blueprint/functions", response_model=ScanResponse)
def add_blueprint_function(project_id: int, function: dict) -> ScanResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    try:
        blueprint_editor.add_function(blueprint, function)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    save_mapping(project_id, blueprint)
    return _rebuild(project)


@router.post(
    "/projects/{project_id}/blueprint/functions/update",
    response_model=ScanResponse,
)
def update_blueprint_function(project_id: int, function: dict) -> ScanResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    try:
        blueprint_editor.update_function(blueprint, function)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    save_mapping(project_id, blueprint)
    return _rebuild(project)


@router.post(
    "/projects/{project_id}/blueprint/functions/delete",
    response_model=ScanResponse,
)
def delete_blueprint_function(project_id: int, payload: dict) -> ScanResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    try:
        blueprint_editor.delete_function(blueprint, payload.get("id", ""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    save_mapping(project_id, blueprint)
    return _rebuild(project)


@router.post(
    "/projects/{project_id}/blueprint/edges/add", response_model=ScanResponse
)
def add_blueprint_edge(project_id: int, edge: dict) -> ScanResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    try:
        blueprint_editor.add_edge(blueprint, edge)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    save_mapping(project_id, blueprint)
    return _rebuild(project)


@router.post(
    "/projects/{project_id}/blueprint/edges/delete", response_model=ScanResponse
)
def delete_blueprint_edge(project_id: int, edge: dict) -> ScanResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    blueprint_editor.delete_edge(
        blueprint, edge.get("source", ""), edge.get("target", "")
    )
    save_mapping(project_id, blueprint)
    return _rebuild(project)


@router.get("/projects/{project_id}/blueprint/export", response_class=PlainTextResponse)
def export_project_blueprint(project_id: int) -> PlainTextResponse:
    project = _require_project(project_id)
    blueprint = _require_blueprint(project_id)
    generated_at = datetime.now(timezone.utc).isoformat()
    content = blueprint_editor.export_markdown(
        blueprint, project["name"], generated_at
    )
    return PlainTextResponse(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=blueprint_spec.md"
        },
    )


@router.delete("/projects/{project_id}")
def remove_project(project_id: int) -> dict:
    if not delete_project(project_id):
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")
    log("info", "api.routes", "删除项目", {"project_id": project_id})
    return {"deleted": project_id}


@router.post("/logs/export")
def export_logs(request: LogExportRequest) -> dict:
    logs = query_logs(request.start, request.end, request.level)
    log("info", "api.routes", "导出日志", {"count": len(logs), "level": request.level})
    return {"logs": logs}


@router.get("/logs/export", response_class=PlainTextResponse)
def export_logs_csv(start: str, end: str, level: str = "all") -> PlainTextResponse:
    logs = query_logs(start, end, level)
    return PlainTextResponse(
        content=export_csv(logs),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=blueprint_logs.csv"},
    )
