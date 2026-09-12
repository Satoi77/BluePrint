import { useMemo } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

export default function IsolatedPool() {
  const raw = useBlueprintStore((state) => state.raw);
  const visibleLevel = useBlueprintStore((state) => state.visibleLevel);
  const select = useBlueprintStore((state) => state.select);

  const isolated = useMemo(() => {
    if (!raw) return [];
    const targetLevel = visibleLevel <= 0 ? 0 : 1;
    return raw.nodes.filter(
      (node) => node.is_isolated && node.level === targetLevel,
    );
  }, [raw, visibleLevel]);

  if (isolated.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-30 max-h-[calc(100vh-220px)] w-[210px] overflow-auto rounded-md border border-line bg-panel/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="mb-1.5 font-mono text-[0.68rem] text-ink">
        孤立功能（{isolated.length}）
      </div>
      <div className="flex flex-col gap-0.5">
        {isolated.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => select(node.id)}
            className="truncate rounded px-1.5 py-0.5 text-left font-mono text-[0.66rem] text-muted transition-colors hover:bg-blueprint-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
            title={node.id}
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}
