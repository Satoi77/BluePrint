import type { Node } from "@xyflow/react";

import type { RawEdge, RawNode } from "../services/api";
import type { CircleNodeData } from "../components/CircleNode";

export type HierarchyNode = Node<CircleNodeData, "circle">;

const A_CELL_X = 92;
const A_CELL_Y = 86;
const A_TOP = 96;
const GAP = 90;

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

function groupByParent(nodes: RawNode[]): Map<string, RawNode[]> {
  const map = new Map<string, RawNode[]>();
  for (const node of nodes) {
    const parent = node.parent_id ?? "";
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent)!.push(node);
  }
  return map;
}

interface SubSize {
  w: number;
  h: number;
  cols: number;
}

interface BlockLayout {
  colW: number;
  rowH: number;
  cols: number;
}

/**
 * 嵌套网格分区布局：
 * L0 大功能块各自占一块区域；块内 L1 子功能成网格；每个 L1 下的 L2 原子功能成网格。
 * 每个子功能预留出容纳其原子功能的空间，避免任何层级重叠。
 */
export function layoutHierarchy(
  nodes: RawNode[],
  _edges: RawEdge[],
  positions: Record<string, { x: number; y: number }> = {},
): HierarchyNode[] {
  const blocks = nodes.filter((node) => node.level === 0);
  const groups = nodes.filter((node) => node.level === 1);
  const atomics = nodes.filter((node) => node.level === 2);
  const pos = new Map<string, { x: number; y: number }>();

  const atomicsByGroup = groupByParent(atomics);
  const groupsByBlock = groupByParent(groups);

  if (blocks.length === 0) {
    // 无大功能块（文件级视图）：按网格平铺，原子功能置于其父节点下方
    const cols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
    groups.forEach((group, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      pos.set(group.id, { x: col * 260, y: row * 260 });
    });
    for (const [groupId, list] of atomicsByGroup) {
      const base = pos.get(groupId) ?? { x: 0, y: 0 };
      list.forEach((atomic, index) => {
        pos.set(atomic.id, {
          x: base.x + (index % 8) * A_CELL_X,
          y: base.y + A_TOP + Math.floor(index / 8) * A_CELL_Y,
        });
      });
    }
    return nodes.map((node) => {
      const position = positions[node.id] ?? pos.get(node.id) ?? { x: 0, y: 0 };
      return makeNode(node, position.x, position.y);
    });
  }

  // 1) 每个子功能预留空间 = 其原子功能网格
  const subSize = new Map<string, SubSize>();
  for (const group of groups) {
    const count = atomicsByGroup.get(group.id)?.length ?? 0;
    const cols = count > 0 ? Math.ceil(Math.sqrt(count)) : 1;
    const rows = count > 0 ? Math.ceil(count / cols) : 0;
    subSize.set(group.id, {
      w: Math.max(200, cols * A_CELL_X),
      h: A_TOP + rows * A_CELL_Y + 40,
      cols,
    });
  }

  // 2) 每个大功能块预留空间 = 其子功能网格
  const blockLayout = new Map<string, BlockLayout>();
  const blockSize = new Map<string, { w: number; h: number }>();
  for (const block of blocks) {
    const list = groupsByBlock.get(block.id) ?? [];
    const colW = Math.max(200, ...list.map((g) => subSize.get(g.id)!.w)) + GAP;
    const rowH = Math.max(200, ...list.map((g) => subSize.get(g.id)!.h)) + GAP;
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const rows = Math.max(1, Math.ceil(list.length / cols));
    blockLayout.set(block.id, { colW, rowH, cols });
    blockSize.set(block.id, { w: cols * colW, h: rows * rowH });
  }

  // 3) 大功能块按网格铺开
  const blockCols = Math.max(1, Math.ceil(Math.sqrt(blocks.length)));
  const maxW = Math.max(400, ...blocks.map((b) => blockSize.get(b.id)!.w));
  const maxH = Math.max(400, ...blocks.map((b) => blockSize.get(b.id)!.h));
  const BLOCK_GAP = 260;

  blocks.forEach((block, index) => {
    const col = index % blockCols;
    const row = Math.floor(index / blockCols);
    const bx = col * (maxW + BLOCK_GAP);
    const by = row * (maxH + BLOCK_GAP);
    pos.set(block.id, { x: bx + maxW / 2 - 48, y: by });

    const layout = blockLayout.get(block.id)!;
    const list = groupsByBlock.get(block.id) ?? [];
    list.forEach((group, groupIndex) => {
      const gc = groupIndex % layout.cols;
      const gr = Math.floor(groupIndex / layout.cols);
      const sub = subSize.get(group.id)!;
      const gx = bx + gc * layout.colW;
      const gy = by + 150 + gr * layout.rowH;
      pos.set(group.id, { x: gx + sub.w / 2 - 37, y: gy });

      const members = atomicsByGroup.get(group.id) ?? [];
      members.forEach((atomic, atomicIndex) => {
        const ac = atomicIndex % sub.cols;
        const ar = Math.floor(atomicIndex / sub.cols);
        pos.set(atomic.id, {
          x: gx + ac * A_CELL_X,
          y: gy + A_TOP + ar * A_CELL_Y,
        });
      });
    });
  });

  return nodes.map((node) => {
    const position = positions[node.id] ?? pos.get(node.id) ?? { x: 0, y: 0 };
    return makeNode(node, position.x, position.y);
  });
}
