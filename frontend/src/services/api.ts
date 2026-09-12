export type CommitStatus = "recent" | "old" | "uncommitted";

export interface RawNode {
  id: string;
  label: string;
  file_path: string;
  absolute_path: string;
  last_commit_time: string | null;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  status: CommitStatus;
  module_name: string;
  functions: string[];
  is_isolated: boolean;
  group: string;
  files: string[];
  level: number;
  parent_id: string | null;
  kind: "block" | "group" | "file" | "atomic";
  member_count: number;
}

export interface RawEdge {
  source: string;
  target: string;
  relation: "import";
  level: number;
  weight: number;
}

export interface ScanStats {
  files_scanned: number;
  files_skipped: number;
  node_count: number;
  edge_count: number;
}

export interface ScanResponse {
  project_path: string;
  generated_at: string;
  nodes: RawNode[];
  edges: RawEdge[];
  stats: ScanStats;
  warnings: string[];
  project_id: number | null;
  project_name: string | null;
}

export interface Project {
  id: number;
  name: string;
  root_path: string;
  created_at: string;
  last_scanned_at: string;
  node_count: number;
  edge_count: number;
}

export interface LogEntry {
  ts_utc: string;
  level: string;
  module: string;
  message: string;
  context?: unknown;
  exc_text?: string | null;
}

const API_BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "detail" in body
          ? (body as { detail: unknown }).detail
          : `HTTP ${response.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return body as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时：扫描耗时过长或后端无响应");
    }
    if (error instanceof TypeError) {
      throw new Error(
        `无法连接后端（${API_BASE}），请确认 uvicorn 已启动`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function scanProject(
  projectPath: string,
  name?: string,
): Promise<ScanResponse> {
  return request<ScanResponse>("/api/blueprint/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_path: projectPath, name }),
  });
}

export function importHierarchy(
  projectId: number,
  mapping: unknown,
): Promise<ScanResponse> {
  return request<ScanResponse>(`/api/projects/${projectId}/blueprint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>("/api/projects");
}

export function getProjectBlueprint(projectId: number): Promise<ScanResponse> {
  return request<ScanResponse>(`/api/projects/${projectId}/blueprint`);
}

export function deleteProject(projectId: number): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(`/api/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function exportBackendLogs(
  start: string,
  end: string,
  level: string,
): Promise<{ logs: LogEntry[] }> {
  return request<{ logs: LogEntry[] }>("/api/logs/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end, level }),
  });
}
