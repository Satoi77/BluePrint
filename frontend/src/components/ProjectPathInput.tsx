import { useEffect, useState } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

const STORAGE_KEY = "blueprint.lastProjectPath";

export default function ProjectPathInput() {
  const [path, setPath] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  const status = useBlueprintStore((state) => state.status);
  const scan = useBlueprintStore((state) => state.scan);
  const projects = useBlueprintStore((state) => state.projects);
  const activeProjectId = useBlueprintStore((state) => state.activeProjectId);
  const loading = status === "loading";

  const active = projects.find((project) => project.id === activeProjectId);

  // 跟随当前项目；删除全部项目后清空残留地址
  useEffect(() => {
    if (active) {
      setPath(active.root_path);
      localStorage.setItem(STORAGE_KEY, active.root_path);
    } else if (projects.length === 0) {
      setPath("");
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [active, projects.length]);

  const submit = () => {
    const trimmed = path.trim();
    if (!trimmed || loading) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    void scan(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={path}
        onChange={(event) => setPath(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
        placeholder="D:\path\to\project"
        spellCheck={false}
        className="w-[320px] rounded-md border border-line bg-paper px-3 py-1.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-blueprint focus:ring-2 focus:ring-blueprint/20 disabled:opacity-50"
        disabled={loading}
        aria-label="项目目录路径"
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || path.trim().length === 0}
        className="flex items-center gap-2 rounded-md bg-blueprint px-3.5 py-1.5 font-mono text-xs font-medium text-white transition-colors hover:bg-[#264d75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/40 active:bg-[#1f405f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        扫描
      </button>
    </div>
  );
}
