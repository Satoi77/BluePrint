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
from app.services.project_store import (
    delete_project,
    get_blueprint,
    list_projects,
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
