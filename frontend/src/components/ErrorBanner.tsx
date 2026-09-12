import { useBlueprintStore } from "../store/blueprintStore";

export default function ErrorBanner() {
  const error = useBlueprintStore((state) => state.error);
  const clearError = useBlueprintStore((state) => state.clearError);

  if (!error) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-40 w-[min(560px,90vw)] -translate-x-1/2">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-[#e5b4b4] bg-[#fdf3f3] px-4 py-3 shadow-md"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b23c3c"
          strokeWidth="2"
          className="mt-0.5 h-4 w-4 shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        <div className="flex-1">
          <div className="font-mono text-xs font-semibold text-[#8f2f2f]">
            操作失败
          </div>
          <div className="mt-0.5 break-all text-xs text-[#7a3b3b]">{error}</div>
        </div>
        <button
          type="button"
          onClick={clearError}
          className="rounded p-1 text-[#8f2f2f] transition-colors hover:bg-[#f6dede] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b23c3c]/40"
          aria-label="关闭错误提示"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
