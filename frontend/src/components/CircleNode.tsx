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

function shortLabel(label: string): string {
  const parts = label.split("/");
  const short = parts.length > 2 ? parts.slice(-2).join("/") : label;
  return short.length > 24 ? `${short.slice(0, 22)}…` : short;
}

export default function CircleNode({ data }: NodeProps<CircleNodeType>) {
  const dim = data.dimmed && !data.highlighted && !data.selected;
  const showLabel = data.lod === "L2";
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
      style={{ opacity: dim ? 0.15 : 1, transition: "opacity 180ms ease" }}
    >
      <div
        className="relative flex items-center justify-center rounded-full border-2 border-white bg-panel"
        style={{
          width: 54,
          height: 54,
          boxShadow: ring,
          transition: "box-shadow 180ms ease",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-1.5 !w-1.5 !border-0 !bg-muted"
        />
        <span
          className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-black/40"
          style={{ background: STATUS_COLOR[data.raw.status] }}
          title={data.raw.status}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-1.5 !w-1.5 !border-0 !bg-muted"
        />
      </div>
      {showLabel && (
        <div
          className="mt-1 max-w-[128px] truncate font-mono text-[0.66rem] leading-tight text-white"
          title={`${data.raw.label}（${data.raw.files.length} 个文件）`}
        >
          {shortLabel(data.raw.label)}
        </div>
      )}
    </div>
  );
}
