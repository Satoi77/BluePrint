import csv
import io
import json
import sqlite3
import threading
import traceback
from datetime import datetime, timezone
from typing import Any, Optional

from app import config

_lock = threading.Lock()
_initialized = False

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_utc       TEXT NOT NULL,
    level        TEXT NOT NULL,
    module       TEXT NOT NULL,
    message      TEXT NOT NULL,
    context_json TEXT,
    exc_text     TEXT
)
"""


def _connect() -> sqlite3.Connection:
    config.LOG_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(config.LOG_DB_PATH), check_same_thread=False)


def init_db() -> None:
    global _initialized
    with _lock:
        conn = _connect()
        try:
            conn.execute(_CREATE_TABLE)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts_utc)")
            conn.commit()
        finally:
            conn.close()
        _initialized = True


def log(
    level: str,
    module: str,
    message: str,
    context: Optional[dict[str, Any]] = None,
    exc: Optional[BaseException] = None,
) -> None:
    if not _initialized:
        init_db()
    ts = datetime.now(timezone.utc).isoformat()
    context_json = (
        json.dumps(context, ensure_ascii=False, default=str) if context is not None else None
    )
    exc_text = None
    if exc is not None:
        exc_text = "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        )
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO logs (ts_utc, level, module, message, context_json, exc_text)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (ts, level, module, message, context_json, exc_text),
            )
            conn.commit()
        finally:
            conn.close()


def query_logs(start: str, end: str, level: str = "all") -> list[dict[str, Any]]:
    if not _initialized:
        init_db()
    sql = "SELECT ts_utc, level, module, message, context_json, exc_text FROM logs"
    clauses = ["ts_utc >= ?", "ts_utc <= ?"]
    params: list[Any] = [start, end]
    if level and level != "all":
        clauses.append("level = ?")
        params.append(level)
    sql += " WHERE " + " AND ".join(clauses) + " ORDER BY ts_utc ASC"
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()
    result = []
    for ts_utc, lvl, module, message, context_json, exc_text in rows:
        result.append(
            {
                "ts_utc": ts_utc,
                "level": lvl,
                "module": module,
                "message": message,
                "context": json.loads(context_json) if context_json else None,
                "exc_text": exc_text,
            }
        )
    return result


def export_csv(logs: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ts_utc", "level", "module", "message", "context", "exc_text"])
    for item in logs:
        writer.writerow(
            [
                item["ts_utc"],
                item["level"],
                item["module"],
                item["message"],
                json.dumps(item["context"], ensure_ascii=False) if item["context"] else "",
                item["exc_text"] or "",
            ]
        )
    return buffer.getvalue()
