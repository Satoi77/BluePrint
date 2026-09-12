import type { CommitStatus } from "./services/api";
import BlueprintCanvas from "./components/BlueprintCanvas";
import ErrorBanner from "./components/ErrorBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import LogExportPanel from "./components/LogExportPanel";
import ProjectPathInput from "./components/ProjectPathInput";
import SearchBar from "./components/SearchBar";
import { useBlueprintStore } from "./store/blueprintStore";
import { STATUS_COLOR, STATUS_LABEL } from "./utils/commitStatus";

const STATUSES: CommitStatus[] = ["recent", "old", "uncommitted"];

function Legend() {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-md border border-line bg-panel/95 px-3 py-2 font-mono text-[0.66rem] text-muted shadow-sm backdrop-blur">
      <div className="mb-1.5 text-ink">提交状态</div>
      {STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border"
            style={{ borderColor: STATUS_COLOR[status] }}
          />
          {STATUS_LABEL[status]}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const raw = useBlueprintStore((state) => state.raw);

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tracking-tight text-blueprint">
            BluePrint
          </span>
          <span className="font-mono text-[0.66rem] text-muted">项目蓝图</span>
        </div>
        <ProjectPathInput />
        <SearchBar />
        {raw && (
          <div className="ml-auto flex items-center gap-3 font-mono text-[0.66rem] text-muted">
            <span>节点 {raw.stats.node_count}</span>
            <span>连线 {raw.stats.edge_count}</span>
            {raw.stats.files_skipped > 0 && (
              <span className="text-[#b45309]">
                跳过 {raw.stats.files_skipped}
              </span>
            )}
          </div>
        )}
      </header>
      <main className="relative min-h-0 flex-1">
        <ErrorBoundary>
          <BlueprintCanvas />
        </ErrorBoundary>
        <ErrorBanner />
        <Legend />
        <LogExportPanel />
      </main>
    </div>
  );
}
