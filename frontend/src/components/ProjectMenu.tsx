import { useState } from "react";

import { useBlueprintStore } from "../store/blueprintStore";

export default function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const designMode = useBlueprintStore((state) => state.designMode);
  const setDesignMode = useBlueprintStore((state) => state.setDesignMode);
  const createProject = useBlueprintStore((state) => state.createProject);
  const addFunction = useBlueprintStore((state) => state.addFunction);
  const activeProjectId = useBlueprintStore((state) => state.activeProjectId);
  const removeProject = useBlueprintStore((state) => state.removeProject);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void createProject(trimmed, path.trim());
    setName("");
    setPath("");
    setOpen(false);
  };

  const addRoot = () => {
    const id = `root_${Date.now().toString(36)}`;
    void addFunction({
      id,
      name: "新大功能",
      level: 0,
      parent: null,
      kind: "block",
      description: "",
      files: [],
      symbols: [],
      isolated: false,
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="项目菜单"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper text-ink transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-[320px] rounded-md border border-line bg-panel p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-ink">项目</span>
              <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[0.66rem] text-muted">
                <input
                  type="checkbox"
                  checked={designMode}
                  onChange={(event) => setDesignMode(event.target.checked)}
                  className="accent-blueprint"
                />
                创作模式
              </label>
            </div>

            <button
              type="button"
              onClick={addRoot}
              disabled={!activeProjectId}
              className="mb-1.5 w-full rounded border border-blueprint bg-blueprint px-3 py-1.5 text-left font-mono text-xs text-white transition-colors hover:bg-[#264d75] disabled:opacity-40"
            >
              新增根功能（大功能块）
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  activeProjectId &&
                  window.confirm("删除当前项目及其蓝图？")
                ) {
                  void removeProject(activeProjectId);
                  setOpen(false);
                }
              }}
              disabled={!activeProjectId}
              className="w-full rounded border border-[#5a2626] bg-[#1a0f0f] px-3 py-1.5 text-left font-mono text-xs text-[#ff8a8a] transition-colors hover:bg-[#2a1414] disabled:opacity-40"
            >
              删除当前项目
            </button>

            <div className="my-3 border-t border-line" />
            <div className="mb-1.5 font-mono text-[0.66rem] text-muted">
              新建空白项目
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="项目名称"
              className="mb-1.5 w-full rounded border border-line bg-paper px-2 py-1 font-mono text-xs text-ink outline-none focus:border-blueprint"
            />
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="项目地址（可选，用于 Git 增强）"
              spellCheck={false}
              className="mb-2 w-full rounded border border-line bg-paper px-2 py-1 font-mono text-xs text-ink outline-none focus:border-blueprint"
            />
            <button
              type="button"
              onClick={submit}
              disabled={name.trim().length === 0}
              className="w-full rounded border border-line bg-paper px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:border-blueprint disabled:opacity-40"
            >
              新建
            </button>

            <div className="mt-3 border-t border-line pt-2 font-mono text-[0.62rem] leading-relaxed text-muted">
              创作模式：自顶向下设计，箭头「上级→下级」，所有操作自动保存。
              浏览模式：箭头「下级→上级」。
            </div>
          </div>
        </>
      )}
    </div>
  );
}
