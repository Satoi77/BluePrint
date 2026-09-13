import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { RawNode } from "../services/api";
import { STATUS_COLOR } from "../utils/commitStatus";

export interface CircleNodeData {
  raw: RawNode;
  dimmed: boolean;
  highlighted: boolean;
  searchHit: boolean;
  selected: boolean;
  lod: "L0" | "L1" | "L2";
  [key: string]: unknown;
}

export type CircleNodeType = Node<CircleNodeData, "circle">;

export const NODE_SIZES: Record<string, number> = {
  block: 96,
  group: 74,
  file: 60,
  atomic: 50,
};

const FONT_SIZE: Record<string, string> = {
  block: "0.68rem",
  group: "0.6rem",
  file: "0.56rem",
  atomic: "0.5rem",
};

export default function CircleNode({ data }: NodeProps<CircleNodeType>) {
  const dim = data.dimmed && !data.highlighted && !data.selected;
  const size = NODE_SIZES[data.raw.kind] ?? 60;
  const ring = data.selected
    ? "0 0 0 3px rgba(255,255,255,0.55), 0 0 22px rgba(255,255,255,0.55)"
    : data.highlighted
      ? "0 0 0 3px rgba(255,255,255,0.35)"
      : data.searchHit
        ? "0 0 0 3px rgba(79,195,247,0.6)"
        : "none";

  return (
    <div
      className="flex flex-col items-center"
      style={{ opacity: dim ? 0.42 : 1, transition: "opacity 180ms ease" }}
    >
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-panel"
        style={{
          width: size,
          height: size,
          boxShadow: ring,
          transition: "box-shadow 180ms ease",
        }}
        title={data.raw.label}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-1.5 !w-1.5 !border-0 !bg-muted"
        />
        <span
          className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-black/40"
          style={{ background: STATUS_COLOR[data.raw.status] }}
        />
        <span
          className="pointer-events-none line-clamp-4 px-1.5 text-center font-mono leading-tight text-white"
          style={{ fontSize: FONT_SIZE[data.raw.kind] ?? "0.56rem" }}
        >
          {data.raw.label}
        </span>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-1.5 !w-1.5 !border-0 !bg-muted"
        />
      </div>
    </div>
  );
}
