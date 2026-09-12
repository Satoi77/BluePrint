import dagre from "@dagrejs/dagre";
import type { Node } from "@xyflow/react";

import type { RawEdge, RawNode } from "../services/api";
import type { CircleNodeData } from "../components/CircleNode";

export type HierarchyNode = Node<CircleNodeData, "circle">;

function makeNode(raw: RawNode, x: number, y: number): HierarchyNode {
  return {
    id: raw.id,
    type: "circle",
    position: { x, y },
    data: {
      raw,
      dimmed: false,
      highlighted: false,
      searchHit: false,
      selected: false,
      lod: "L2",
    },
  };
}

function arrangeAround(
  center: { x: number; y: number },
  count: number,
  baseRadius: number,
  ringStep: number,
  perRing: number,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const ring = Math.floor(index / perRing);
    const inRing = index % perRing;
    const ringCount = Math.min(perRing, count - ring * perRing);
    const angle = (inRing / Math.max(ringCount, 1)) * Math.PI * 2;
    const radius = baseRadius + ring * ringStep;
    result.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return result;
}

function groupByParent(nodes: RawNode[]): Map<string, RawNode[]> {
  const map = new Map<string, RawNode[]>();
  for (const node of nodes) {
    const parent = node.parent_id ?? "";
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent)!.push(node);
  }
  return map;
}

/**
 * 自上而下的分层布局：
 * L0 大功能块用 dagre 按块间关系排布；L1 子功能环绕所属块；L2 原子功能环绕所属子功能。
 * 坐标一次算定，切换层级不重排。
 */
export function layoutHierarchy(
  nodes: RawNode[],
  edges: RawEdge[],
): HierarchyNode[] {
  const blocks = nodes.filter((node) => node.level === 0);
  const groups = nodes.filter((node) => node.level === 1);
  const atomics = nodes.filter((node) => node.level === 2);

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 160,
    ranksep: 220,
    marginx: 80,
    marginy: 80,
  });
  const blockIds = new Set(blocks.map((block) => block.id));
  for (const block of blocks) {
    graph.setNode(block.id, { width: 150, height: 150 });
  }
  for (const edge of edges.filter((item) => item.level === 0)) {
    if (blockIds.has(edge.source) && blockIds.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(graph);

  const pos = new Map<string, { x: number; y: number }>();
  for (const block of blocks) {
    const point = graph.node(block.id);
    pos.set(block.id, { x: point.x, y: point.y });
  }

  const groupsByBlock = groupByParent(groups);
  for (const [blockId, list] of groupsByBlock) {
    const center = pos.get(blockId) ?? { x: 0, y: 0 };
    const points = arrangeAround(center, list.length, 190, 120, 8);
    list.forEach((group, index) => pos.set(group.id, points[index]));
  }

  const atomicsByGroup = groupByParent(atomics);
  for (const [groupId, list] of atomicsByGroup) {
    const center = pos.get(groupId) ?? { x: 0, y: 0 };
    const points = arrangeAround(center, list.length, 100, 60, 10);
    list.forEach((atomic, index) => pos.set(atomic.id, points[index]));
  }

  return nodes.map((node) => {
    const position = pos.get(node.id) ?? { x: 0, y: 0 };
    return makeNode(node, position.x, position.y);
  });
}
