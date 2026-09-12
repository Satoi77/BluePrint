from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from app.models.schemas import LogExportRequest, ScanRequest, ScanResponse
from app.services.logging_db import export_csv, log, query_logs
from app.services.scan_service import ScanError, scan_project

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@router.post("/blueprint/scan", response_model=ScanResponse)
def scan(request: ScanRequest) -> ScanResponse:
    try:
        return scan_project(request.project_path)
    except ScanError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


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
