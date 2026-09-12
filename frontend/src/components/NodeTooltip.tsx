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
  const width = 340;
  const left = Math.min(x + 16, window.innerWidth - width - 12);
  const top = Math.min(y + 16, window.innerHeight - 300);

  return (
    <div
      className="pointer-events-none fixed z-50 w-[340px] rounded-md border border-line bg-panel/95 p-3 font-mono text-[0.7rem] text-ink shadow-xl backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-2 flex items-center gap-2 border-b border-line pb-2">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: STATUS_COLOR[node.status] }}
        />
        <span className="min-w-0 flex-1 break-all text-[0.74rem] font-semibold">
          {node.label}
        </span>
      </div>

      <Row label="状态">{STATUS_LABEL[node.status]}</Row>
      <Row label="最近提交">{formatAbsolute(node.last_commit_time)}</Row>
      <Row label="相对时间">{formatRelative(node.last_commit_time)}</Row>
      <Row label="提交 hash">{node.last_commit_hash?.slice(0, 10) ?? "—"}</Row>
      <Row label="提交信息">{node.last_commit_message ?? "—"}</Row>

      <div className="mt-2 border-t border-line pt-2">
        <div className="mb-1 text-muted">包含文件（{node.files.length}）</div>
        <div className="max-h-[150px] overflow-auto">
          {node.files.length === 0 && <div className="text-muted">—</div>}
          {node.files.map((file) => (
            <div key={file} className="break-all py-0.5 text-[0.66rem] text-ink/90">
              {file}
            </div>
          ))}
        </div>
      </div>

      {node.functions.length > 0 && (
        <div className="mt-2 border-t border-line pt-2">
          <div className="mb-1 text-muted">函数（{node.functions.length}）</div>
          <div className="max-h-[80px] overflow-auto text-[0.66rem] text-ink/90">
            {node.functions.join(", ")}
          </div>
        </div>
      )}
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
