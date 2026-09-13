import { useMemo, useState } from "react";

import type { RawNode } from "../services/api";
import { useBlueprintStore } from "../store/blueprintStore";

/** 模糊匹配：子串优先，其次按顺序的子序列；返回分值，不匹配返回 null。 */
function fuzzyScore(text: string, query: string): number | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (q.length === 0) return null;
  const index = t.indexOf(q);
  if (index >= 0) return 10000 - index;
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return null;
    streak = idx === ti ? streak + 1 : 0;
    score += 1 + streak;
    ti = idx + 1;
  }
  return score;
}

const LEVEL_TAG: Record<number, string> = {
  0: "根",
  1: "主干",
  2: "枝干",
  3: "树叶",
};

export default function SearchBar() {
  const raw = useBlueprintStore((state) => state.raw);
  const select = useBlueprintStore((state) => state.select);
  const setFocus = useBlueprintStore((state) => state.setFocus);
  const setShowAllAtomics = useBlueprintStore(
    (state) => state.setShowAllAtomics,
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim();
    if (!raw || q.length === 0) return [];
    const scored: { node: RawNode; score: number }[] = [];
    for (const node of raw.nodes) {
      const score = fuzzyScore(node.label, q);
      if (score !== null) scored.push({ node, score });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score || a.node.label.localeCompare(b.node.label),
    );
    return scored.slice(0, 24).map((item) => item.node);
  }, [raw, query]);

  const reveal = (node: RawNode) => {
    const byId = new Map((raw?.nodes ?? []).map((item) => [item.id, item]));
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    setShowAllAtomics(false);
    setFocus(parent && parent.parent_id ? parent.id : null);
    select(node.id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setOpen(false);
            } else if (event.key === "Enter" && results.length > 0) {
              reveal(results[0]);
            }
          }}
          placeholder="搜索功能（模糊）"
          spellCheck={false}
          className="w-[240px] rounded-md border border-line bg-paper py-1.5 pl-8 pr-3 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-blueprint focus:ring-2 focus:ring-blueprint/20"
          aria-label="搜索功能"
        />
      </div>

      {open && query.trim().length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-[360px] w-[300px] overflow-auto rounded-md border border-line bg-panel p-1 shadow-xl">
            {results.length === 0 && (
              <div className="px-3 py-2 font-mono text-[0.68rem] text-muted">
                无匹配功能
              </div>
            )}
            {results.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => reveal(node)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-blueprint-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
              >
                <span className="shrink-0 rounded border border-line px-1 font-mono text-[0.58rem] text-muted">
                  {LEVEL_TAG[node.level] ?? `L${node.level}`}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
                  {node.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
