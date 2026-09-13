import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ViewportPortal,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";

import type { RawNode } from "../services/api";
import { computeHighlight, useBlueprintStore } from "../store/blueprintStore";
import { layoutHierarchy } from "../layout/hierarchyLayout";
import CircleNode, {
  NODE_SIZES,
  type CircleNodeData,
  type CircleNodeType,
} from "./CircleNode";
import NodeTooltip from "./NodeTooltip";
import {
  colorForGroup,
  buildGroupColorMap,
  HIGHLIGHT_COLOR,
} from "../utils/groupColor";

const nodeTypes = { circle: CircleNode } as NodeTypes;
const INTERSECTION_COLOR = "#FF4D6D";

function visibleAt(level: number, visible: number): boolean {
  if (visible <= 0) return level === 0;
  if (visible === 1) return level === 1;
  return level === 1 || level === 2;
}

interface Point {
  x: number;
  y: number;
}

function centerOf(node: { position: Point; data: CircleNodeData }): Point {
  const size = NODE_SIZES[node.data.raw.kind] ?? 60;
  return { x: node.position.x + size / 2, y: node.position.y + size / 2 };
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
  if (t > 0.08 && t < 0.92 && u > 0.08 && u < 0.92) {
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }
  return null;
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
  const visibleLevel = useBlueprintStore((state) => state.visibleLevel);
  const positions = useBlueprintStore((state) => state.positions);
  const moveNode = useBlueprintStore((state) => state.moveNode);
  const addEdge = useBlueprintStore((state) => state.addEdge);
  const removeEdge = useBlueprintStore((state) => state.removeEdge);
  const [hover, setHover] = useState<HoverState | null>(null);
  const instanceRef = useRef<ReactFlowInstance<CircleNodeType, Edge> | null>(
    null,
  );

  const allNodes = useMemo(
    () => (raw ? layoutHierarchy(raw.nodes, raw.edges, positions) : []),
    [raw, positions],
  );

  const edgeLevel = visibleLevel <= 0 ? 0 : 1;
  const levelEdges = useMemo(
    () => (raw?.edges ?? []).filter((edge) => edge.level === edgeLevel),
    [raw, edgeLevel],
  );
  const highlight = useMemo(
    () => computeHighlight(levelEdges, selectedId),
    [levelEdges, selectedId],
  );
  const groupColors = useMemo(
    () => buildGroupColorMap((raw?.nodes ?? []).map((node) => node.group)),
    [raw],
  );
  const groupById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of raw?.nodes ?? []) map.set(node.id, node.group);
    return map;
  }, [raw]);
  const query = searchQuery.trim().toLowerCase();

  const displayNodes = useMemo(
    () =>
      allNodes
        .filter((node) => visibleAt(node.data.raw.level, visibleLevel))
        .map((node) => {
          const hit =
            query.length > 0 &&
            (node.data.raw.label.toLowerCase().includes(query) ||
              node.data.raw.files.some((file) =>
                file.toLowerCase().includes(query),
              ));
          const related = highlight.nodes.has(node.id);
          const dimmed =
            (selectedId !== null && !related) || (query.length > 0 && !hit);
          return {
            ...node,
            data: {
              ...node.data,
              dimmed,
              highlighted:
                selectedId !== null && related && node.id !== selectedId,
              searchHit: hit,
              selected: node.id === selectedId,
            },
          };
        }),
    [allNodes, visibleLevel, highlight, selectedId, query],
  );

  const displayEdges = useMemo<Edge[]>(
    () =>
      levelEdges.map((edge) => {
        const isHighlighted = highlight.edges.has(
          `${edge.source}->${edge.target}`,
        );
        const groupColor = colorForGroup(
          groupColors,
          groupById.get(edge.source) ?? "",
        );
        return {
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: "default",
          animated: isHighlighted,
          style: {
            stroke: isHighlighted ? HIGHLIGHT_COLOR : groupColor,
            strokeWidth: isHighlighted ? 2.6 : 1.7,
            strokeLinecap: "round",
            opacity: selectedId !== null ? (isHighlighted ? 1 : 0.32) : 0.72,
          },
        };
      }),
    [levelEdges, highlight, selectedId, groupColors, groupById],
  );

  const intersections = useMemo(() => {
    const centers = new Map<string, Point>();
    for (const node of allNodes) {
      if (visibleAt(node.data.raw.level, visibleLevel)) {
        centers.set(node.id, centerOf(node));
      }
    }
    const segments = levelEdges
      .filter((edge) => centers.has(edge.source) && centers.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        a: centers.get(edge.source)!,
        b: centers.get(edge.target)!,
      }));
    const points: Point[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        if (
          segments[i].source === segments[j].source ||
          segments[i].source === segments[j].target ||
          segments[i].target === segments[j].source ||
          segments[i].target === segments[j].target
        ) {
          continue;
        }
        const point = segmentIntersection(
          segments[i].a,
          segments[i].b,
          segments[j].a,
          segments[j].b,
        );
        if (point) points.push(point);
      }
    }
    return points;
  }, [allNodes, levelEdges, visibleLevel]);

  const fitKey = `${raw?.project_id ?? 0}:${visibleLevel}:${
    raw?.stats.node_count ?? 0
  }`;
  useEffect(() => {
    instanceRef.current?.fitView({
      padding: 0.25,
      duration: 300,
      minZoom: 0.2,
      maxZoom: 1,
    });
  }, [fitKey]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        minZoom={0.05}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.25, minZoom: 0.2, maxZoom: 1 }}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => select(node.id)}
        onNodeDragStop={(_, node) => moveNode(node.id, node.position.x, node.position.y)}
        onPaneClick={() => select(null)}
        onConnect={(connection) => {
          if (connection.source && connection.target) {
            void addEdge({
              source: connection.source,
              target: connection.target,
              type: "manual",
            });
          }
        }}
        onEdgeClick={(_, edge) => {
          if (window.confirm("删除这条连线？")) {
            void removeEdge({ source: edge.source, target: edge.target });
          }
        }}
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
        <ViewportPortal>
          {intersections.map((point, index) => (
            <div
              key={`${point.x.toFixed(1)}-${point.y.toFixed(1)}-${index}`}
              className="pointer-events-none absolute rounded-full border border-black/50"
              style={{
                width: 9,
                height: 9,
                left: point.x - 4.5,
                top: point.y - 4.5,
                background: INTERSECTION_COLOR,
                boxShadow: `0 0 6px ${INTERSECTION_COLOR}`,
              }}
            />
          ))}
        </ViewportPortal>
      </ReactFlow>

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
          </div>
        </div>
      )}

      {hover && <NodeTooltip node={hover.node} x={hover.x} y={hover.y} />}
    </div>
  );
}
