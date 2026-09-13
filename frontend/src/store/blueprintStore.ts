import { create } from "zustand";

import {
  addBlueprintEdge,
  addBlueprintFunction,
  deleteBlueprintEdge,
  deleteBlueprintFunction,
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  fetchBlueprintSpec,
  getBlueprintSource,
  getProjectBlueprint,
  listProjects,
  savePositions,
  scanProject,
  updateBlueprintFunction,
  type AgentBlueprint,
  type BpEdge,
  type BpFunction,
  type Project,
  type RawEdge,
  type ScanResponse,
} from "../services/api";
import { downloadText, log } from "../services/logger";

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
  focusId: string | null;
  setFocus: (id: string | null) => void;
  blueprintSource: AgentBlueprint | null;
  positions: Record<string, { x: number; y: number }>;
  designMode: boolean;
  setDesignMode: (value: boolean) => void;
  createProject: (name: string, path: string) => Promise<void>;
  setVisibleLevel: (level: number) => void;
  init: () => Promise<void>;
  scan: (path: string, name?: string) => Promise<void>;
  openProject: (id: number) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (query: string) => void;
  clearError: () => void;
  loadSource: () => Promise<void>;
  moveNode: (id: string, x: number, y: number) => void;
  addFunction: (fn: BpFunction) => Promise<void>;
  updateFunction: (fn: BpFunction) => Promise<void>;
  removeFunction: (id: string) => Promise<void>;
  addEdge: (edge: BpEdge) => Promise<void>;
  removeEdge: (edge: BpEdge) => Promise<void>;
  exportSpec: () => Promise<void>;
}

export const useBlueprintStore = create<BlueprintState>((set, get) => {
  const msg = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  const refreshSource = async (id: number | null) => {
    if (!id) {
      set({ blueprintSource: null });
      return;
    }
    try {
      set({ blueprintSource: await getBlueprintSource(id) });
    } catch {
      set({ blueprintSource: null });
    }
  };

  const applyEdit = async (data: ScanResponse) => {
    set({
      raw: normalize(data),
      status: "success",
      positions: data.positions ?? {},
    });
    await refreshSource(get().activeProjectId);
  };

  return {
  projects: [],
  activeProjectId: null,
  raw: null,
  status: "idle",
  error: null,
  selectedId: null,
  searchQuery: "",
  visibleLevel: 1,
  focusId: null,
  blueprintSource: null,
  positions: {},
  designMode: false,

  setVisibleLevel: (level) => set({ visibleLevel: level }),
  setFocus: (id) => set({ focusId: id }),
  setDesignMode: (value) => set({ designMode: value }),

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
        positions: data.positions ?? {},
        focusId: null,
      });
      if (data.project_id) {
        localStorage.setItem(ACTIVE_KEY, String(data.project_id));
      }
      set({ projects: await listProjects() });
      await refreshSource(data.project_id);
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
      set({
        raw: data,
        status: "success",
        activeProjectId: id,
        positions: data.positions ?? {},
        focusId: null,
      });
      localStorage.setItem(ACTIVE_KEY, String(id));
      await refreshSource(id);
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

  loadSource: async () => {
    await refreshSource(get().activeProjectId);
  },

  moveNode: (id, x, y) => {
    set({ positions: { ...get().positions, [id]: { x, y } } });
    const projectId = get().activeProjectId;
    if (projectId) {
      void savePositions(projectId, { [id]: { x, y } }).catch((error) => {
        log("warn", "store.blueprint", "保存节点位置失败", {
          message: msg(error),
        });
      });
    }
  },

  addFunction: async (fn) => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      await applyEdit(await addBlueprintFunction(id, fn));
      set({ selectedId: fn.id });
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "新增功能失败", { message: msg(error) });
    }
  },

  updateFunction: async (fn) => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      await applyEdit(await updateBlueprintFunction(id, fn));
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "更新功能失败", { message: msg(error) });
    }
  },

  removeFunction: async (functionId) => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      await applyEdit(await deleteBlueprintFunction(id, functionId));
      set({ selectedId: null });
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "删除功能失败", { message: msg(error) });
    }
  },

  addEdge: async (edge) => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      await applyEdit(await addBlueprintEdge(id, edge));
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "新增连线失败", { message: msg(error) });
    }
  },

  removeEdge: async (edge) => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      await applyEdit(await deleteBlueprintEdge(id, edge));
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "删除连线失败", { message: msg(error) });
    }
  },

  exportSpec: async () => {
    const id = get().activeProjectId;
    if (!id) return;
    try {
      const text = await fetchBlueprintSpec(id);
      downloadText(`blueprint_spec_${id}.md`, text);
      log("info", "store.blueprint", "导出功能说明", { projectId: id });
    } catch (error) {
      set({ error: msg(error) });
    }
  },

  createProject: async (name, path) => {
    try {
      const project = await apiCreateProject(name, path);
      set({ projects: await listProjects() });
      await get().openProject(project.id);
      log("info", "store.blueprint", "新建空白项目", { id: project.id });
    } catch (error) {
      set({ error: msg(error) });
      log("error", "store.blueprint", "新建项目失败", {
        message: msg(error),
      });
    }
  },
};
});

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
