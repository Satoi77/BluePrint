from dataclasses import dataclass, field
from typing import Literal, Optional

from pydantic import BaseModel


@dataclass
class ImportRef:
    kind: Literal["import", "from"]
    module: Optional[str]
    names: list[str]
    level: int
    lineno: int


@dataclass
class FileMeta:
    rel_path: str
    abs_path: str
    module_dotted: str
    is_package: bool
    imports: list[ImportRef] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)


@dataclass
class CommitInfo:
    hash: str
    iso_time: str
    message: str


class ScanRequest(BaseModel):
    project_path: str
    name: Optional[str] = None
    granularity: Literal["function", "file"] = "function"


class ProjectModel(BaseModel):
    id: int
    name: str
    root_path: str
    created_at: str
    last_scanned_at: str
    node_count: int
    edge_count: int


class NodeModel(BaseModel):
    id: str
    label: str
    file_path: str
    absolute_path: str
    last_commit_time: Optional[str] = None
    last_commit_hash: Optional[str] = None
    last_commit_message: Optional[str] = None
    status: Literal["recent", "old", "uncommitted"]
    module_name: str
    functions: list[str] = []
    is_isolated: bool = False
    group: str = ""
    files: list[str] = []


class EdgeModel(BaseModel):
    source: str
    target: str
    relation: Literal["import"] = "import"


class ScanStats(BaseModel):
    files_scanned: int
    files_skipped: int
    node_count: int
    edge_count: int


class ScanResponse(BaseModel):
    project_path: str
    generated_at: str
    nodes: list[NodeModel]
    edges: list[EdgeModel]
    stats: ScanStats
    warnings: list[str] = []
    project_id: Optional[int] = None
    project_name: Optional[str] = None


class LogExportRequest(BaseModel):
    start: str
    end: str
    level: str = "all"
