import type { RawNode } from "../services/api";
import {
  STATUS_COLOR,
  STATUS_LABEL,
  formatAbsolute,
  formatRelative,
} from "../utils/commitStatus";

interface NodeTooltipProps {
  node: RawNode;
  x: number;
  y: number;
}

export default function NodeTooltip({ node, x, y }: NodeTooltipProps) {
  const width = 300;
  const left = Math.min(x + 16, window.innerWidth - width - 12);
  const top = Math.min(y + 16, window.innerHeight - 240);

  return (
    <div
      className="pointer-events-none fixed z-50 w-[300px] rounded-md border border-line bg-panel/95 p-3 font-mono text-[0.7rem] text-ink shadow-lg backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-2 break-all border-b border-line pb-2 text-[0.72rem] font-semibold">
        {node.file_path}
      </div>
      <Row label="状态">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: STATUS_COLOR[node.status] }}
        />
        {STATUS_LABEL[node.status]}
      </Row>
      <Row label="最近提交">{formatAbsolute(node.last_commit_time)}</Row>
      <Row label="相对时间">{formatRelative(node.last_commit_time)}</Row>
      <Row label="提交 hash">{node.last_commit_hash?.slice(0, 10) ?? "—"}</Row>
      <Row label="提交信息">{node.last_commit_message ?? "—"}</Row>
      <Row label="模块名">{node.module_name || "—"}</Row>
      <Row label="函数">{node.functions.length > 0 ? node.functions.join(", ") : "—"}</Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span className="flex items-center gap-1 break-all">{children}</span>
    </div>
  );
}
