import { useBlueprintStore } from "../store/blueprintStore";

const LEVELS = [
  { value: 0, label: "大功能块" },
  { value: 1, label: "子功能" },
  { value: 2, label: "原子功能" },
];

export default function LevelSwitcher() {
  const visibleLevel = useBlueprintStore((state) => state.visibleLevel);
  const setVisibleLevel = useBlueprintStore((state) => state.setVisibleLevel);

  return (
    <div className="flex overflow-hidden rounded-md border border-line">
      {LEVELS.map((level) => {
        const active = level.value === visibleLevel;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => setVisibleLevel(level.value)}
            className={`px-3 py-1.5 font-mono text-[0.68rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30 ${
              active
                ? "bg-blueprint text-white"
                : "bg-paper text-muted hover:text-ink"
            }`}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
