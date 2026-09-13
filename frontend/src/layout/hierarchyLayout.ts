import type { Node } from "@xyflow/react";

import type { RawNode } from "../services/api";
import type { CircleNodeData } from "../components/CircleNode";

export type HierarchyNode = Node<CircleNodeData, "circle">;

const CELL_X = 172;
const CELL_Y = 148;

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
 * 按信息密度（连接度）排列的紧凑网格：
 * - 低连接度的节点靠近中心，高连接度的枢纽（如数据库访问）排到**最外围**，
 *   使大量连线朝外汇聚，减少中心交叉。
 * - 用户拖动过的位置优先。
 */
export function compactLayout(
  nodes: RawNode[],
  positions: Record<string, { x: number; y: number }> = {},
  degree?: Map<string, number>,
): HierarchyNode[] {
  const sorted = [...nodes].sort((a, b) => {
    const da = degree?.get(a.id) ?? 0;
    const db = degree?.get(b.id) ?? 0;
    if (da !== db) return da - db;
    if (a.level !== b.level) return a.level - b.level;
    const pa = a.parent_id ?? "";
    const pb = b.parent_id ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    return a.id.localeCompare(b.id);
  });

  const count = sorted.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;

  const cells: { c: number; r: number; d: number }[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({ c, r, d: (c - centerX) ** 2 + (r - centerY) ** 2 });
    }
  }
  // 由内向外分配：低连接度 → 中心，高连接度 → 外围
  cells.sort((a, b) => a.d - b.d);

  return sorted.map((raw, index) => {
    const saved = positions[raw.id];
    const cell = cells[index];
    const position = saved ?? { x: cell.c * CELL_X, y: cell.r * CELL_Y };
    return makeNode(raw, position.x, position.y);
  });
}
