import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ViewportPortal,
  getBezierPath,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";

import type { RawEdge, RawNode } from "../services/api";
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
  // 累进式：放大时保留上层上下文，跨层边才能显示
  return level <= visible;
}

interface Point {
  x: number;
  y: number;
}

function sizeOf(node: RawNode): number {
  return NODE_SIZES[node.kind] ?? 60;
}

function centerOf(node: { position: Point; data: CircleNodeData }): Point {
  const size = sizeOf(node.data.raw);
  return { x: node.position.x + size / 2, y: node.position.y + size / 2 };
}

/** 用 React Flow 的贝塞尔路径采样出折线点，保证交点落在真实曲线上。 */
function sampleEdge(
  source: { center: Point; size: number },
  target: { center: Point; size: number },
): Point[] {
  const sourceX = source.center.x;
  const sourceY = source.center.y + source.size / 2;
  const targetX = target.center.x;
  const targetY = target.center.y - target.size / 2;
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
  });
  const numbers = (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  if (numbers.length < 8) {
    return [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
  }
  const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = numbers;
  const points: Point[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push({
      x:
        mt * mt * mt * x0 +
        3 * mt * mt * t * c1x +
        3 * mt * t * t * c2x +
        t * t * t * x1,
      y:
        mt * mt * mt * y0 +
        3 * mt * mt * t * c1y +
        3 * mt * t * t * c2y +
        t * t * t * y1,
    });
  }
  return points;
}

function segmentIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null {
  const denom = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denom;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }
  return null;
}

function polylineIntersections(p: Point[], q: Point[]): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < p.length - 1; i += 1) {
    for (let j = 0; j < q.length - 1; j += 1) {
      const point = segmentIntersection(p[i], p[i + 1], q[j], q[j + 1]);
      if (point) result.push(point);
    }
  }
  return result;
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
  const designMode = useBlueprintStore((state) => state.designMode);
  const [hover, setHover] = useState<HoverState | null>(null);
  const instanceRef = useRef<ReactFlowInstance<CircleNodeType, Edge> | null>(
    null,
  );

  const allNodes = useMemo(
    () => (raw ? layoutHierarchy(raw.nodes, raw.edges, positions) : []),
    [raw, positions],
  );

  const levelOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of raw?.nodes ?? []) map.set(node.id, node.level);
    return map;
  }, [raw]);

  const activeEdges = useMemo<RawEdge[]>(() => {
    const edges = raw?.edges ?? [];
    const maxBase = visibleLevel <= 0 ? 0 : 1;
    const base = edges.filter((edge) => edge.level <= maxBase);
    if (visibleLevel === 2 && selectedId) {
      const atomic = edges.filter(
        (edge) =>
          edge.level === 2 &&
          (edge.source === selectedId || edge.target === selectedId),
      );
      return [...base, ...atomic];
    }
    return base;
  }, [raw, visibleLevel, selectedId]);

  const highlight = useMemo(
    () => computeHighlight(activeEdges, selectedId),
    [activeEdges, selectedId],
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
              groupColor: colorForGroup(
                groupColors,
                node.data.raw.group,
              ),
            },
          };
        }),
    [allNodes, visibleLevel, highlight, selectedId, query, groupColors],
  );

  const displayEdges = useMemo<Edge[]>(
    () =>
      activeEdges.map((edge) => {
        const isHighlighted = highlight.edges.has(
          `${edge.source}->${edge.target}`,
        );
        const groupColor = colorForGroup(
          groupColors,
          groupById.get(edge.source) ?? "",
        );
        const stroke = isHighlighted ? HIGHLIGHT_COLOR : groupColor;
        // 创作模式：上级→下级（自顶向下）；浏览模式：下级→上级
        const sourceLevel = levelOf.get(edge.source) ?? 1;
        const targetLevel = levelOf.get(edge.target) ?? 1;
        const arrowAtTarget = designMode
          ? sourceLevel <= targetLevel
          : sourceLevel >= targetLevel;
        const marker = {
          type: MarkerType.ArrowClosed,
          color: stroke,
          width: 15,
          height: 15,
        };
        return {
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: "default",
          animated: isHighlighted,
          markerEnd: arrowAtTarget ? marker : undefined,
          markerStart: arrowAtTarget ? undefined : marker,
          style: {
            stroke,
            strokeWidth: isHighlighted ? 2.6 : 1.7,
            strokeLinecap: "round",
            opacity: selectedId !== null ? (isHighlighted ? 1 : 0.32) : 0.72,
            animationDirection: arrowAtTarget ? "reverse" : "normal",
          },
        };
      }),
    [activeEdges, highlight, selectedId, groupColors, groupById, levelOf, designMode],
  );

  const intersections = useMemo(() => {
    const geometry = new Map<string, { center: Point; size: number }>();
    for (const node of allNodes) {
      if (visibleAt(node.data.raw.level, visibleLevel)) {
        geometry.set(node.id, {
          center: centerOf(node),
          size: sizeOf(node.data.raw),
        });
      }
    }
    const polylines = activeEdges
      .filter(
        (edge) => geometry.has(edge.source) && geometry.has(edge.target),
      )
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        points: sampleEdge(
          geometry.get(edge.source)!,
          geometry.get(edge.target)!,
        ),
      }));
    const points: Point[] = [];
    for (let i = 0; i < polylines.length; i += 1) {
      for (let j = i + 1; j < polylines.length; j += 1) {
        const a = polylines[i];
        const b = polylines[j];
        if (
          a.source === b.source ||
          a.source === b.target ||
          a.target === b.source ||
          a.target === b.target
        ) {
          continue;
        }
        points.push(...polylineIntersections(a.points, b.points));
      }
    }
    return points;
  }, [allNodes, activeEdges, visibleLevel]);

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
        onNodeDragStop={(_, node) =>
          moveNode(node.id, node.position.x, node.position.y)
        }
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
            <div className="font-mono text-sm text-ink">
              {designMode ? "创作模式：空白蓝图" : "未发现可解析的节点"}
            </div>
            <div className="mt-2 break-all text-xs text-muted">
              {designMode
                ? "从左上角菜单点「新增根功能」开始设计；悬停节点、拖动连接点即可连线。"
                : raw.warnings.length > 0
                  ? raw.warnings.join("；")
                  : "该目录下没有可解析的 Python 文件"}
            </div>
          </div>
        </div>
      )}

      {designMode && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded border border-blueprint bg-panel/90 px-2.5 py-0.5 font-mono text-[0.62rem] text-blueprint">
          创作模式 · 箭头 上级→下级 · 自动保存
        </div>
      )}

      {hover && <NodeTooltip node={hover.node} x={hover.x} y={hover.y} />}
    </div>
  );
}
