import { useEffect, useMemo, useState } from "react";

import { useBlueprintStore } from "../store/blueprintStore";
import { STATUS_LABEL, formatAbsolute } from "../utils/commitStatus";

const KIND_BY_LEVEL: Record<number, string> = {
  0: "block",
  1: "group",
  2: "atomic",
};

const LEVEL_LABEL: Record<number, string> = {
  0: "大功能块",
  1: "子功能",
  2: "原子功能",
};

export default function NodeEditor() {
  const selectedId = useBlueprintStore((state) => state.selectedId);
  const source = useBlueprintStore((state) => state.blueprintSource);
  const raw = useBlueprintStore((state) => state.raw);
  const updateFunction = useBlueprintStore((state) => state.updateFunction);
  const removeFunction = useBlueprintStore((state) => state.removeFunction);
  const addFunction = useBlueprintStore((state) => state.addFunction);
  const select = useBlueprintStore((state) => state.select);

  const fn = useMemo(
    () => source?.functions.find((item) => item.id === selectedId) ?? null,
    [source, selectedId],
  );
  const rawNode = useMemo(
    () => raw?.nodes.find((node) => node.id === selectedId) ?? null,
    [raw, selectedId],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(1);
  const [parent, setParent] = useState("");
  const [files, setFiles] = useState("");
  const [symbols, setSymbols] = useState("");
  const [isolated, setIsolated] = useState(false);

  useEffect(() => {
    if (!fn) return;
    setName(fn.name);
    setDescription(fn.description ?? "");
    setLevel(fn.level);
    setParent(fn.parent ?? "");
    setFiles((fn.files ?? []).join("\n"));
    setSymbols((fn.symbols ?? []).join("\n"));
    setIsolated(Boolean(fn.isolated));
  }, [fn]);

  if (!selectedId) return null;

  const parents = (source?.functions ?? []).filter(
    (item) => item.level === level - 1 && item.id !== selectedId,
  );

  const save = () => {
    if (!fn) return;
    void updateFunction({
      id: fn.id,
      name: name.trim() || fn.id,
      level,
      parent: level === 0 ? null : parent || null,
      kind: KIND_BY_LEVEL[level] ?? "atomic",
      description: description.trim(),
      files: files
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      symbols: symbols
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      isolated,
    });
  };

  const addChild = () => {
    if (!fn) return;
    const childLevel = Math.min(fn.level + 1, 2);
    const id = `${fn.id}.new_${Date.now().toString(36)}`;
    void addFunction({
      id,
      name: "新功能",
      level: childLevel,
      parent: fn.id,
      kind: KIND_BY_LEVEL[childLevel],
      description: "",
      files: [],
      symbols: [],
      isolated: false,
    });
  };

  const addSibling = () => {
    if (!fn) return;
    const id = `${fn.parent ?? "root"}.new_${Date.now().toString(36)}`;
    void addFunction({
      id,
      name: "新功能",
      level: fn.level,
      parent: fn.parent,
      kind: KIND_BY_LEVEL[fn.level],
      description: "",
      files: [],
      symbols: [],
      isolated: false,
    });
  };

  const remove = () => {
    if (!fn) return;
    if (window.confirm(`删除「${fn.name}」及其全部子节点？`)) {
      void removeFunction(fn.id);
    }
  };

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-[300px] overflow-auto border-l border-line bg-panel p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          {fn ? "编辑功能" : "节点信息"}
        </span>
        <button
          type="button"
          onClick={() => select(null)}
          className="rounded px-1.5 py-0.5 font-mono text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/30"
        >
          关闭
        </button>
      </div>

      {!fn && (
        <div className="space-y-2 font-mono text-[0.7rem] text-muted">
          <div className="text-ink">{rawNode?.label ?? selectedId}</div>
          <div className="break-all">{rawNode?.files?.[0] ?? ""}</div>
          <div>
            该节点为软件从文件自动列出的原子功能（派生节点），不可直接编辑。
            请编辑其上层功能，或在蓝图源中显式定义。
          </div>
        </div>
      )}

      {fn && (
        <div className="space-y-3 font-mono text-[0.7rem]">
          <Field label="id（只读）">
            <div className="break-all text-muted">{fn.id}</div>
          </Field>

          <Field label="名称">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
            />
          </Field>

          <Field label="描述">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full resize-y rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
            />
          </Field>

          <Field label="层级">
            <select
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
              className="w-full rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
            >
              {[0, 1, 2].map((value) => (
                <option key={value} value={value}>
                  {value} · {LEVEL_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>

          {level > 0 && (
            <Field label="父功能">
              <select
                value={parent}
                onChange={(event) => setParent(event.target.value)}
                className="w-full rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
              >
                <option value="">（未指定）</option>
                {parents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="文件（每行一个）">
            <textarea
              value={files}
              onChange={(event) => setFiles(event.target.value)}
              rows={4}
              spellCheck={false}
              className="w-full resize-y rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
            />
          </Field>

          <Field label="符号（每行一个）">
            <textarea
              value={symbols}
              onChange={(event) => setSymbols(event.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-y rounded border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-blueprint"
            />
          </Field>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isolated}
              onChange={(event) => setIsolated(event.target.checked)}
              className="accent-blueprint"
            />
            标记为孤立功能
          </label>

          {rawNode && (
            <div className="rounded border border-line bg-paper px-2 py-1 text-muted">
              <div>
                状态：{STATUS_LABEL[rawNode.status]} · {formatAbsolute(rawNode.last_commit_time)}
              </div>
              <div className="break-all">
                {rawNode.last_commit_message ?? "无提交"}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              className="rounded bg-blueprint px-3 py-1.5 text-white transition-colors hover:bg-[#264d75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint/40"
            >
              保存
            </button>
            <button
              type="button"
              onClick={addChild}
              disabled={fn.level >= 2}
              className="rounded border border-line bg-paper px-3 py-1.5 text-ink transition-colors hover:border-blueprint disabled:opacity-40"
            >
              新增子节点
            </button>
            <button
              type="button"
              onClick={addSibling}
              className="rounded border border-line bg-paper px-3 py-1.5 text-ink transition-colors hover:border-blueprint"
            >
              新增同级
            </button>
            <button
              type="button"
              onClick={remove}
              className="rounded border border-[#5a2626] bg-[#1a0f0f] px-3 py-1.5 text-[#ff8a8a] transition-colors hover:bg-[#2a1414]"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-muted">{label}</div>
      {children}
    </div>
  );
}
