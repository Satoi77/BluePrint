import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { RawNode } from "../services/api";
import { STATUS_COLOR } from "../utils/commitStatus";

export interface CircleNodeData {
  raw: RawNode;
  dimmed: boolean;
  highlighted: boolean;
  searchHit: boolean;
  selected: boolean;
  [key: string]: unknown;
}

export type CircleNodeType = Node<CircleNodeData, "circle">;

function truncate(label: string): string {
  return label.length > 24 ? `${label.slice(0, 22)}…` : label;
}

export default function CircleNode({ data }: NodeProps<CircleNodeType>) {
  const color = STATUS_COLOR[data.raw.status];
  const dim = data.dimmed && !data.highlighted && !data.selected;
  const ring = data.selected
    ? `0 0 0 3px ${color}55, 0 0 20px ${color}66`
    : data.highlighted
      ? "0 0 0 3px #2F5D8C44"
      : data.searchHit
        ? "0 0 0 3px #2F5D8C66"
        : "none";

  return (
    <div
      className="flex flex-col items-center"
      style={{ opacity: dim ? 0.2 : 1, transition: "opacity 180ms ease" }}
    >
      <div
        className="relative flex items-center justify-center rounded-full border-2 bg-panel"
        style={{
          width: 56,
          height: 56,
          borderColor: color,
          boxShadow: ring,
          transition: "box-shadow 180ms ease",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!h-1.5 !w-1.5 !border-0 !bg-line"
        />
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-1.5 !w-1.5 !border-0 !bg-line"
        />
      </div>
      <div
        className="mt-1 max-w-[128px] truncate font-mono text-[0.66rem] leading-tight text-ink"
        title={data.raw.file_path}
      >
        {truncate(data.raw.label)}
      </div>
    </div>
  );
}
