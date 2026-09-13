import { useEffect, useMemo } from "react";

import type { CommitStatus } from "./services/api";
import BlueprintCanvas from "./components/BlueprintCanvas";
import ErrorBanner from "./components/ErrorBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import IsolatedPool from "./components/IsolatedPool";
import LevelSwitcher from "./components/LevelSwitcher";
import LogExportPanel from "./components/LogExportPanel";
import NodeEditor from "./components/NodeEditor";
import ProjectMenu from "./components/ProjectMenu";
import ProjectPathInput from "./components/ProjectPathInput";
import ProjectSwitcher from "./components/ProjectSwitcher";
import SearchBar from "./components/SearchBar";
import { useBlueprintStore } from "./store/blueprintStore";
import { STATUS_COLOR, STATUS_LABEL } from "./utils/commitStatus";
import { buildGroupColorMap } from "./utils/groupColor";

const STATUSES: CommitStatus[] = ["recent", "old", "uncommitted"];

function Legend() {
  const raw = useBlueprintStore((state) => state.raw);

  const groups = useMemo(() => {
    if (!raw) return [];
    const level0 = raw.nodes.filter((node) => node.level === 0);
    if (level0.length > 0) {
      const colors = buildGroupColorMap(level0.map((node) => node.group));
      return level0
        .map((node) => ({
          key: node.id,
          label: node.label,
          count: node.files.length,
          color: colors[node.group],
        }))
        .sort((a, b) => b.count - a.count);
    }
    const counts = new Map<string, number>();
    for (const node of raw.nodes) {
      counts.set(
        node.group,
        (counts.get(node.group) ?? 0) + (node.files?.length ?? 0),
      );
    }
    const colors = buildGroupColorMap([...counts.keys()]);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([group, count]) => ({
        key: group,
        label: group,
        count,
        color: colors[group],
      }));
  }, [raw]);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 max-h-[calc(100vh-160px)] w-[190px] overflow-auto rounded-md border border-line bg-panel/95 px-3 py-2 font-mono text-[0.66rem] text-muted shadow-sm backdrop-blur">
      <div className="mb-1.5 text-ink">提交状态</div>
      {STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-black/40"
            style={{ background: STATUS_COLOR[status] }}
          />
          {STATUS_LABEL[status]}
        </div>
      ))}

      {groups.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 border-t border-line pt-2 text-ink">
            功能模块（文件数）
          </div>
          {groups.map((item) => (
            <div key={item.key} className="flex items-center gap-2 py-0.5">
              <span
                className="inline-block h-0.5 w-4 shrink-0 rounded"
                style={{ background: item.color }}
              />
              <span className="min-w-0 flex-1 truncate" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0">{item.count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function App() {
  const raw = useBlueprintStore((state) => state.raw);
  const selectedId = useBlueprintStore((state) => state.selectedId);
  const exportSpec = useBlueprintStore((state) => state.exportSpec);
  const init = useBlueprintStore((state) => state.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <ProjectMenu />
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tracking-tight text-blueprint">
            BluePrint
          </span>
          <span className="font-mono text-[0.66rem] text-muted">项目蓝图</span>
        </div>
        <ProjectSwitcher />
        <ProjectPathInput />
        <LevelSwitcher />
        <SearchBar />
        {raw && (
          <div className="ml-auto flex items-center gap-3 font-mono text-[0.66rem] text-muted">
            <span>节点 {raw.stats.node_count}</span>
            <span>连线 {raw.stats.edge_count}</span>
            {raw.stats.files_skipped > 0 && (
              <span className="text-[#FFB74D]">
                跳过 {raw.stats.files_skipped}
              </span>
            )}
            <button
              type="button"
              onClick={() => void exportSpec()}
              className="rounded border border-line bg-paper px-2.5 py-1 text-ink transition-colors hover:border-blueprint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
            >
              导出说明
            </button>
          </div>
        )}
      </header>
      <main className="relative min-h-0 flex-1">
        <ErrorBoundary>
          <BlueprintCanvas />
        </ErrorBoundary>
        <ErrorBanner />
        {selectedId === null && <Legend />}
        <IsolatedPool />
        <NodeEditor />
        <LogExportPanel />
      </main>
    </div>
  );
}
