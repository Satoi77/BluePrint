import { useMemo } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

export default function Breadcrumb() {
  const raw = useBlueprintStore((state) => state.raw);
  const focusId = useBlueprintStore((state) => state.focusId);
  const setFocus = useBlueprintStore((state) => state.setFocus);
  const designMode = useBlueprintStore((state) => state.designMode);

  const focusNode = raw?.nodes.find((node) => node.id === focusId);
  const atRoot = !focusId || !focusNode?.parent_id;

  const chain = useMemo(() => {
    if (!raw || !focusId || atRoot) return [];
    const byId = new Map(raw.nodes.map((node) => [node.id, node]));
    const result: { id: string; label: string }[] = [];
    let current = byId.get(focusId);
    while (current && current.parent_id) {
      result.unshift({ id: current.id, label: current.label });
      current = byId.get(current.parent_id);
    }
    return result;
  }, [raw, focusId, atRoot]);

  if (designMode) {
    return (
      <div className="font-mono text-[0.68rem] text-muted">
        创作模式 · 显示全部层级
      </div>
    );
  }

  const crumb =
    "rounded px-1.5 py-0.5 transition-colors hover:bg-blueprint-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30";

  return (
    <div className="flex items-center gap-0.5 font-mono text-[0.68rem]">
      <button
        type="button"
        onClick={() => setFocus(null)}
        className={`${crumb} ${atRoot ? "text-ink" : "text-muted"}`}
      >
        根
      </button>
      {chain.map((item) => (
        <span key={item.id} className="flex items-center gap-0.5">
          <span className="text-muted">›</span>
          <button
            type="button"
            onClick={() => setFocus(item.id)}
            className={`${crumb} ${
              item.id === focusId ? "text-ink" : "text-muted"
            }`}
          >
            {item.label}
          </button>
        </span>
      ))}
      {!atRoot && (
        <button
          type="button"
          onClick={() => {
            const current = raw?.nodes.find((node) => node.id === focusId);
            const parent = current?.parent_id
              ? raw?.nodes.find((node) => node.id === current.parent_id)
              : undefined;
            setFocus(parent?.parent_id ? parent!.id : null);
          }}
          className="ml-2 rounded border border-line bg-paper px-2 py-0.5 text-ink transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
        >
          返回上级
        </button>
      )}
    </div>
  );
}
