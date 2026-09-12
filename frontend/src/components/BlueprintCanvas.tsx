import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeTypes,
} from "@xyflow/react";

import type { RawNode } from "../services/api";
import { computeHighlight, useBlueprintStore } from "../store/blueprintStore";
import { buildEdges, layoutGraph } from "../layout/dagreLayout";
import CircleNode, { type CircleNodeData } from "./CircleNode";
import NodeTooltip from "./NodeTooltip";
import { colorForGroup, buildGroupColorMap, HIGHLIGHT_COLOR } from "../utils/groupColor";

const nodeTypes = { circle: CircleNode } as NodeTypes;

type Lod = "L0" | "L1" | "L2";

function lodForZoom(zoom: number): Lod {
  if (zoom < 0.28) return "L0";
  if (zoom < 0.5) return "L1";
  return "L2";
}

interface HoverState {
  node: RawNode;
  x: number;
  y: number;
}

export default function BlueprintCanvas() {
  const raw = useBlueprintStore((state) => state.raw);
  const status = useBlueprintStore((state) => state.status);
  const selectedId = useBlueprintStore((state) => state.selectedId);
  const searchQuery = useBlueprintStore((state) => state.searchQuery);
  const select = useBlueprintStore((state) => state.select);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [lod, setLod] = useState<Lod>("L2");

  const baseNodes = useMemo(
    () => (raw ? layoutGraph(raw.nodes, raw.edges) : []),
    [raw],
  );
  const baseEdges = useMemo(() => (raw ? buildEdges(raw.edges) : []), [raw]);
  const highlight = useMemo(
    () => computeHighlight(raw?.edges ?? [], selectedId),
    [raw, selectedId],
  );
  const groupById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of raw?.nodes ?? []) map.set(node.id, node.group);
    return map;
  }, [raw]);
  const groupColors = useMemo(
    () => buildGroupColorMap((raw?.nodes ?? []).map((node) => node.group)),
    [raw],
  );
  const query = searchQuery.trim().toLowerCase();

  const displayNodes = useMemo(
    () =>
      baseNodes.map((node) => {
        const hit =
          query.length > 0 &&
          (node.data.raw.label.toLowerCase().includes(query) ||
            node.data.raw.file_path.toLowerCase().includes(query));
        const related = highlight.nodes.has(node.id);
        const dimmed =
          (selectedId !== null && !related) || (query.length > 0 && !hit);
        return {
          ...node,
          data: {
            ...node.data,
            dimmed,
            highlighted: selectedId !== null && related && node.id !== selectedId,
            searchHit: hit,
            selected: node.id === selectedId,
            lod,
          },
        };
      }),
    [baseNodes, highlight, selectedId, query, lod],
  );

  const displayEdges = useMemo(() => {
    if (lod === "L0") return [];
    return baseEdges.map((edge) => {
      const isHighlighted = highlight.edges.has(edge.id);
      const groupColor = colorForGroup(
        groupColors,
        groupById.get(edge.source) ?? "",
      );
      const stroke =
        selectedId !== null
          ? isHighlighted
            ? HIGHLIGHT_COLOR
            : groupColor
          : groupColor;
      const opacity = selectedId !== null ? (isHighlighted ? 1 : 0.05) : 0.5;
      return {
        ...edge,
        animated: isHighlighted,
        style: {
          stroke,
          strokeWidth: isHighlighted ? 2.5 : 1.4,
          opacity,
        },
      };
    });
  }, [baseEdges, highlight, selectedId, groupColors, groupById, lod]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        key={raw?.generated_at ?? "empty"}
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1 }}
        onMove={(_, viewport) => {
          const next = lodForZoom(viewport.zoom);
          setLod((current) => (current === next ? current : next));
        }}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        onNodeMouseEnter={(event, node) =>
          setHover({
            node: (node.data as CircleNodeData).raw,
            x: event.clientX,
            y: event.clientY,
          })
        }
        onNodeMouseLeave={() => setHover(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={28}
          lineWidth={1}
          color="#151B26"
        />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>

      <div className="pointer-events-none absolute bottom-4 right-16 z-30 rounded border border-line bg-panel/80 px-2 py-0.5 font-mono text-[0.6rem] text-muted">
        LOD {lod}
      </div>

      {status === "idle" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-dashed border-line bg-panel/80 px-6 py-5 text-center">
            <div className="font-mono text-sm text-ink">尚未加载蓝图</div>
            <div className="mt-1 text-xs text-muted">
              在上方输入项目目录，点击「扫描」生成蓝图
            </div>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-paper/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-md border border-line bg-panel px-5 py-3 font-mono text-sm">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blueprint border-t-transparent" />
            正在扫描项目…
          </div>
        </div>
      )}

      {status === "success" && raw && raw.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-md rounded-lg border border-dashed border-line bg-panel/85 px-6 py-5 text-center">
            <div className="font-mono text-sm text-ink">未发现可解析的节点</div>
            <div className="mt-2 break-all text-xs text-muted">
              {raw.warnings.length > 0
                ? raw.warnings.join("；")
                : "该目录下没有可解析的 Python 文件"}
            </div>
            <div className="mt-2 font-mono text-[0.66rem] text-muted">
              当前 MVP 仅解析 Python（.py）源文件
            </div>
          </div>
        </div>
      )}

      {hover && <NodeTooltip node={hover.node} x={hover.x} y={hover.y} />}
    </div>
  );
}
