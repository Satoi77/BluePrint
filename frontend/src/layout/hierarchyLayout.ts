import type { Node } from "@xyflow/react";

import type { RawNode } from "../services/api";
import type { CircleNodeData } from "../components/CircleNode";

export type HierarchyNode = Node<CircleNodeData, "circle">;

const CELL_X = 138;
const CELL_Y = 116;

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
      groupColor: "#8A93A3",
    },
  };
}

/**
 * 紧凑网格布局：仅对**当前可见**的节点排布。
 * 按 (层级, 父, id) 排序，使同级同父相邻；单元格紧凑，一屏可见大量节点。
 * 已保存的用户位置优先。
 */
export function compactLayout(
  nodes: RawNode[],
  positions: Record<string, { x: number; y: number }> = {},
): HierarchyNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const pa = a.parent_id ?? "";
    const pb = b.parent_id ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    return a.id.localeCompare(b.id);
  });
  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  return sorted.map((raw, index) => {
    const saved = positions[raw.id];
    const position = saved ?? {
      x: (index % cols) * CELL_X,
      y: Math.floor(index / cols) * CELL_Y,
    };
    return makeNode(raw, position.x, position.y);
  });
}
