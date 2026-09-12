import type { CommitStatus } from "../services/api";

export const STATUS_COLOR: Record<CommitStatus, string> = {
  recent: "#22c55e",
  old: "#64748b",
  uncommitted: "#3b82f6",
};

export const STATUS_LABEL: Record<CommitStatus, string> = {
  recent: "7 天内有提交",
  old: "7 天前提交",
  uncommitted: "未提交",
};

export function formatAbsolute(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "无提交记录";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatAbsolute(iso);
}
