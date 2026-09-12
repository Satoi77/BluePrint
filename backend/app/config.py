from pathlib import Path

IGNORE_DIRS = {
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "build",
    "dist",
    ".mypy_cache",
    ".pytest_cache",
    ".idea",
    "site-packages",
}

RECENT_DAYS = 7

BACKEND_DIR = Path(__file__).resolve().parent.parent
LOG_DB_PATH = BACKEND_DIR / "data" / "blueprint_logs.db"

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
