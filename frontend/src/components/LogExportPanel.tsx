import { useState } from "react";

import { exportBackendLogs } from "../services/api";
import { downloadJson, log, queryLogs } from "../services/logger";

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

export default function LogExportPanel() {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(toLocalInput(weekAgo));
  const [end, setEnd] = useState(toLocalInput(now));
  const [level, setLevel] = useState("all");
  const [message, setMessage] = useState("");

  const range = () => ({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  });

  const exportFrontend = async () => {
    try {
      const { start: s, end: e } = range();
      const logs = await queryLogs(s, e, level);
      downloadJson(`frontend_logs_${Date.now()}.json`, logs);
      setMessage(`已导出前端日志 ${logs.length} 条`);
      void log("info", "ui.log_export", "导出前端日志", { count: logs.length });
    } catch (error) {
      setMessage(`前端日志导出失败: ${String(error)}`);
    }
  };

  const exportBackend = async () => {
    try {
      const { start: s, end: e } = range();
      const result = await exportBackendLogs(s, e, level);
      downloadJson(`backend_logs_${Date.now()}.json`, result.logs);
      setMessage(`已导出后端日志 ${result.logs.length} 条`);
      void log("info", "ui.log_export", "导出后端日志", {
        count: result.logs.length,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-30 w-[280px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-2 flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs text-ink shadow-sm transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        日志导出
      </button>

      {open && (
        <div className="rounded-md border border-line bg-panel p-3 shadow-md">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 font-mono text-[0.68rem] text-muted">
              起始时间
              <input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-1 w-full rounded border border-line bg-paper px-2 py-1 font-mono text-[0.68rem] text-ink outline-none focus:border-blueprint"
              />
            </label>
            <label className="col-span-2 font-mono text-[0.68rem] text-muted">
              结束时间
              <input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-1 w-full rounded border border-line bg-paper px-2 py-1 font-mono text-[0.68rem] text-ink outline-none focus:border-blueprint"
              />
            </label>
            <label className="col-span-2 font-mono text-[0.68rem] text-muted">
              级别
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="mt-1 w-full rounded border border-line bg-paper px-2 py-1 font-mono text-[0.68rem] text-ink outline-none focus:border-blueprint"
              >
                <option value="all">全部</option>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={exportBackend}
              className="flex-1 rounded border border-blueprint bg-blueprint px-2 py-1.5 font-mono text-[0.68rem] text-white transition-colors hover:bg-[#264d75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/40"
            >
              导出后端
            </button>
            <button
              type="button"
              onClick={exportFrontend}
              className="flex-1 rounded border border-line bg-paper px-2 py-1.5 font-mono text-[0.68rem] text-ink transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
            >
              导出前端
            </button>
          </div>
          {message && (
            <div className="mt-2 break-all font-mono text-[0.66rem] text-muted">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
