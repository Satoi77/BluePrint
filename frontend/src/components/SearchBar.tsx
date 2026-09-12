import { useMemo } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

export default function SearchBar() {
  const raw = useBlueprintStore((state) => state.raw);
  const searchQuery = useBlueprintStore((state) => state.searchQuery);
  const setSearch = useBlueprintStore((state) => state.setSearch);

  const matches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!raw || query.length === 0) return null;
    return raw.nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.file_path.toLowerCase().includes(query),
    ).length;
  }, [raw, searchQuery]);

  return (
    <div className="flex items-center gap-2">
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
          value={searchQuery}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearch("");
          }}
          placeholder="搜索文件名或路径"
          spellCheck={false}
          className="w-[220px] rounded-md border border-line bg-paper py-1.5 pl-8 pr-3 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-blueprint focus:ring-2 focus:ring-blueprint/20"
          aria-label="搜索节点"
        />
      </div>
      {matches !== null && (
        <span className="font-mono text-[0.68rem] text-muted">
          {matches} 个匹配
        </span>
      )}
    </div>
  );
}
