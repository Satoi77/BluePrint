import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

import type { RawEdge, RawNode } from "../services/api";
import type { CircleNodeData } from "../components/CircleNode";

export const NODE_WIDTH = 128;
export const NODE_HEIGHT = 84;

export type CircleNode = Node<CircleNodeData, "circle">;

function gridFallback(rawNodes: RawNode[]): CircleNode[] {
  const sorted = [...rawNodes].sort((a, b) => a.file_path.localeCompare(b.file_path));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  return sorted.map((raw, index) => ({
    id: raw.id,
    type: "circle" as const,
    position: {
      x: (index % columns) * 150,
      y: Math.floor(index / columns) * 150,
    },
    data: { raw, dimmed: false, highlighted: false, searchHit: false, selected: false },
  }));
}

export function layoutGraph(rawNodes: RawNode[], rawEdges: RawEdge[]): CircleNode[] {
  if (rawNodes.length === 0) return [];
  try {
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 90, marginx: 40, marginy: 40 });
    for (const node of rawNodes) {
      graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const edge of rawEdges) {
      graph.setEdge(edge.source, edge.target);
    }
    dagre.layout(graph);
    return rawNodes.map((raw) => {
      const point = graph.node(raw.id);
      return {
        id: raw.id,
        type: "circle" as const,
        position: {
          x: point.x - NODE_WIDTH / 2,
          y: point.y - NODE_HEIGHT / 2,
        },
        data: { raw, dimmed: false, highlighted: false, searchHit: false, selected: false },
      };
    });
  } catch {
    return gridFallback(rawNodes);
  }
}

export function buildEdges(rawEdges: RawEdge[]): Edge[] {
  return rawEdges.map((edge) => ({
    id: `${edge.source}->${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    style: { stroke: "#B9C2CE", strokeWidth: 1.4 },
  }));
}
