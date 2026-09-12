import { create } from "zustand";

import {
  scanProject,
  type RawEdge,
  type ScanResponse,
} from "../services/api";
import { log } from "../services/logger";

export type LoadStatus = "idle" | "loading" | "success" | "error";

export interface Highlight {
  nodes: Set<string>;
  edges: Set<string>;
}

interface BlueprintState {
  raw: ScanResponse | null;
  status: LoadStatus;
  error: string | null;
  selectedId: string | null;
  searchQuery: string;
  scan: (path: string) => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (query: string) => void;
  clearError: () => void;
}

export const useBlueprintStore = create<BlueprintState>((set) => ({
  raw: null,
  status: "idle",
  error: null,
  selectedId: null,
  searchQuery: "",
  scan: async (path: string) => {
    set({ status: "loading", error: null });
    log("info", "store.blueprint", "开始扫描", { path });
    try {
      const data = await scanProject(path);
      set({ raw: data, status: "success", selectedId: null, searchQuery: "" });
      log("info", "store.blueprint", "扫描成功", data.stats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ status: "error", error: message });
      log("error", "store.blueprint", "扫描失败", { message });
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
