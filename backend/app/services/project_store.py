import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app import config
from app.models.schemas import ScanResponse

_lock = threading.Lock()
_initialized = False

_CREATE_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS projects (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        root_path       TEXT NOT NULL UNIQUE,
        created_at      TEXT NOT NULL,
        last_scanned_at TEXT NOT NULL,
        node_count      INTEGER NOT NULL DEFAULT 0,
        edge_count      INTEGER NOT NULL DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS blueprints (
        project_id   INTEGER PRIMARY KEY,
        generated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS hierarchies (
        project_id   INTEGER PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    )
    """,
)


def _connect() -> sqlite3.Connection:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(config.DB_PATH), check_same_thread=False)


def init_db() -> None:
    global _initialized
    with _lock:
        conn = _connect()
        try:
            for statement in _CREATE_STATEMENTS:
                conn.execute(statement)
            conn.commit()
        finally:
            conn.close()
        _initialized = True


def _ensure() -> None:
    if not _initialized:
        init_db()


def _row_to_project(row: tuple) -> dict[str, Any]:
    return {
        "id": row[0],
        "name": row[1],
        "root_path": row[2],
        "created_at": row[3],
        "last_scanned_at": row[4],
        "node_count": row[5],
        "edge_count": row[6],
    }


def save_project(
    project_path: str, response: ScanResponse, name: Optional[str] = None
) -> dict[str, Any]:
    """按 root_path upsert 项目并写入蓝图快照，返回项目记录。"""
    _ensure()
    root = str(Path(project_path).resolve())
    display_name = name or Path(root).name or root
    now = datetime.now(timezone.utc).isoformat()
    payload = response.model_dump_json()

    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO projects
                    (name, root_path, created_at, last_scanned_at, node_count, edge_count)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(root_path) DO UPDATE SET
                    name = excluded.name,
                    last_scanned_at = excluded.last_scanned_at,
                    node_count = excluded.node_count,
                    edge_count = excluded.edge_count
                """,
                (
                    display_name,
                    root,
                    now,
                    now,
                    response.stats.node_count,
                    response.stats.edge_count,
                ),
            )
            row = conn.execute(
                "SELECT id, name, root_path, created_at, last_scanned_at,"
                " node_count, edge_count FROM projects WHERE root_path = ?",
                (root,),
            ).fetchone()
            project_id = row[0]
            conn.execute(
                """
                INSERT INTO blueprints (project_id, generated_at, payload_json)
                VALUES (?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                    generated_at = excluded.generated_at,
                    payload_json = excluded.payload_json
                """,
                (project_id, response.generated_at, payload),
            )
            conn.commit()
            return _row_to_project(row)
        finally:
            conn.close()


def list_projects() -> list[dict[str, Any]]:
    _ensure()
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT id, name, root_path, created_at, last_scanned_at,"
                " node_count, edge_count FROM projects ORDER BY last_scanned_at DESC"
            ).fetchall()
        finally:
            conn.close()
    return [_row_to_project(row) for row in rows]


def get_blueprint(project_id: int) -> Optional[dict[str, Any]]:
    _ensure()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT payload_json FROM blueprints WHERE project_id = ?",
                (project_id,),
            ).fetchone()
        finally:
            conn.close()
    if row is None:
        return None
    return json.loads(row[0])


def get_project(project_id: int) -> Optional[dict[str, Any]]:
    _ensure()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id, name, root_path, created_at, last_scanned_at,"
                " node_count, edge_count FROM projects WHERE id = ?",
                (project_id,),
            ).fetchone()
        finally:
            conn.close()
    return _row_to_project(row) if row else None


def get_project_id(project_path: str) -> Optional[int]:
    _ensure()
    root = str(Path(project_path).resolve())
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id FROM projects WHERE root_path = ?", (root,)
            ).fetchone()
        finally:
            conn.close()
    return row[0] if row else None


def save_mapping(project_id: int, mapping: dict[str, Any]) -> None:
    _ensure()
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO hierarchies (project_id, payload_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (project_id, json.dumps(mapping, ensure_ascii=False), now),
            )
            conn.commit()
        finally:
            conn.close()


def get_mapping(project_id: int) -> Optional[dict[str, Any]]:
    _ensure()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT payload_json FROM hierarchies WHERE project_id = ?",
                (project_id,),
            ).fetchone()
        finally:
            conn.close()
    if row is None:
        return None
    return json.loads(row[0])


def delete_project(project_id: int) -> bool:
    _ensure()
    with _lock:
        conn = _connect()
        try:
            conn.execute("DELETE FROM blueprints WHERE project_id = ?", (project_id,))
            conn.execute("DELETE FROM hierarchies WHERE project_id = ?", (project_id,))
            cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
