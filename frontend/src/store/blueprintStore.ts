import { create } from "zustand";

import {
  deleteProject as apiDeleteProject,
  getProjectBlueprint,
  listProjects,
  scanProject,
  type Project,
  type RawEdge,
  type ScanResponse,
} from "../services/api";
import { log } from "../services/logger";

export type LoadStatus = "idle" | "loading" | "success" | "error";

export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>;
}

const ACTIVE_KEY = "blueprint.activeProjectId";

function normalize(data: ScanResponse): ScanResponse {
  return {
    ...data,
    nodes: data.nodes.map((node) => ({
      ...node,
      files: node.files ?? [],
      functions: node.functions ?? [],
      group: node.group ?? "",
      level: node.level ?? 1,
      kind: node.kind ?? "file",
      parent_id: node.parent_id ?? null,
      member_count: node.member_count ?? 0,
    })),
    edges: data.edges.map((edge) => ({
      ...edge,
      level: edge.level ?? 1,
      weight: edge.weight ?? 1,
    })),
  };
}

interface BlueprintState {
  projects: Project[];
  activeProjectId: number | null;
  raw: ScanResponse | null;
  status: LoadStatus;
  error: string | null;
  selectedId: string | null;
  searchQuery: string;
  visibleLevel: number;
  setVisibleLevel: (level: number) => void;
  init: () => Promise<void>;
  scan: (path: string, name?: string) => Promise<void>;
  openProject: (id: number) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (query: string) => void;
  clearError: () => void;
}

export const useBlueprintStore = create<BlueprintState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  raw: null,
  status: "idle",
  error: null,
  selectedId: null,
  searchQuery: "",
  visibleLevel: 0,

  setVisibleLevel: (level) => set({ visibleLevel: level }),

  init: async () => {
    try {
      const projects = await listProjects();
      set({ projects });
      const stored = Number(localStorage.getItem(ACTIVE_KEY));
      const target = projects.find((item) => item.id === stored) ?? projects[0];
      if (target) {
        await get().openProject(target.id);
      } else {
        set({ status: "idle" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ status: "error", error: message });
      log("error", "store.blueprint", "加载项目列表失败", { message });
    }
  },

  scan: async (path, name) => {
    set({ status: "loading", error: null });
    log("info", "store.blueprint", "开始扫描", { path });
    try {
      const data = normalize(await scanProject(path, name));
      set({
        raw: data,
        status: "success",
        selectedId: null,
        searchQuery: "",
        activeProjectId: data.project_id,
      });
      if (data.project_id) {
        localStorage.setItem(ACTIVE_KEY, String(data.project_id));
      }
      set({ projects: await listProjects() });
      log("info", "store.blueprint", "扫描成功", data.stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ status: "error", error: message });
      log("error", "store.blueprint", "扫描失败", { message });
    }
  },

  openProject: async (id) => {
    set({ status: "loading", error: null, selectedId: null, searchQuery: "" });
    try {
      const data = normalize(await getProjectBlueprint(id));
      set({ raw: data, status: "success", activeProjectId: id });
      localStorage.setItem(ACTIVE_KEY, String(id));
      log("info", "store.blueprint", "打开项目", {
        id,
        name: data.project_name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ status: "error", error: message });
      log("error", "store.blueprint", "打开项目失败", { id, message });
    }
  },

  removeProject: async (id) => {
    try {
      await apiDeleteProject(id);
      const projects = await listProjects();
      set({ projects });
      if (get().activeProjectId === id) {
        const next = projects[0];
        if (next) {
          await get().openProject(next.id);
        } else {
          localStorage.removeItem(ACTIVE_KEY);
          set({ raw: null, activeProjectId: null, status: "idle" });
        }
      }
      log("info", "store.blueprint", "删除项目", { id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message });
      log("error", "store.blueprint", "删除项目失败", { id, message });
    }
  },

  select: (id) => set({ selectedId: id }),
  setSearch: (query) => set({ searchQuery: query }),
  clearError: () => set({ error: null }),
}));

export function computeHighlight(edges: RawEdge[], id: string | null): Highlight {
  const nodes = new Set<string>();
  const edgeKeys = new Set<string>();
  if (!id) return { nodes, edges: edgeKeys };

  const forward = new Map<string, RawEdge[]>();
  const backward = new Map<string, RawEdge[]>();
  for (const edge of edges) {
    if (!forward.has(edge.source)) forward.set(edge.source, []);
    forward.get(edge.source)!.push(edge);
    if (!backward.has(edge.target)) backward.set(edge.target, []);
    backward.get(edge.target)!.push(edge);
  }

  const walk = (start: string, map: Map<string, RawEdge[]>) => {
    const queue = [start];
    const seen = new Set<string>([start]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of map.get(current) ?? []) {
        edgeKeys.add(`${edge.source}->${edge.target}`);
        const next = map === forward ? edge.target : edge.source;
        if (!seen.has(next)) {
          seen.add(next);
          nodes.add(next);
          queue.push(next);
        }
      }
    }
  };

  walk(id, forward);
  walk(id, backward);
  nodes.add(id);
  return { nodes, edges: edgeKeys };
}
