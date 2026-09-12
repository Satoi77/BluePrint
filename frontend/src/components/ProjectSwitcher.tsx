import { useState } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

export default function ProjectSwitcher() {
  const projects = useBlueprintStore((state) => state.projects);
  const activeProjectId = useBlueprintStore((state) => state.activeProjectId);
  const openProject = useBlueprintStore((state) => state.openProject);
  const removeProject = useBlueprintStore((state) => state.removeProject);
  const [open, setOpen] = useState(false);

  const active = projects.find((project) => project.id === activeProjectId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[160px] truncate">
          {active ? active.name : "选择项目"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3 w-3 text-muted"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 max-h-[360px] w-[340px] overflow-auto rounded-md border border-line bg-panel p-1 shadow-xl"
          >
            {projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted">
                暂无已保存项目，扫描一个目录即可添加
              </div>
            )}
            {projects.map((project) => (
              <div
                key={project.id}
                role="option"
                aria-selected={project.id === activeProjectId}
                className={`group flex cursor-pointer items-start gap-2 rounded px-2 py-2 transition-colors ${
                  project.id === activeProjectId
                    ? "bg-blueprint-soft"
                    : "hover:bg-blueprint-soft/60"
                }`}
                onClick={() => {
                  setOpen(false);
                  if (project.id !== activeProjectId) void openProject(project.id);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-ink">
                    {project.name}
                  </div>
                  <div className="truncate font-mono text-[0.62rem] text-muted">
                    {project.root_path}
                  </div>
                  <div className="font-mono text-[0.62rem] text-muted">
                    节点 {project.node_count} · 连线 {project.edge_count}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeProject(project.id);
                  }}
                  className="rounded p-1 text-muted opacity-0 transition-opacity hover:bg-[#3a1414] hover:text-[#ff8a8a] group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`删除项目 ${project.name}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
