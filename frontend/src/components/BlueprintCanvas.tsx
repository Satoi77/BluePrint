import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";

import type { RawNode } from "../services/api";
import { computeHighlight, useBlueprintStore } from "../store/blueprintStore";
import { compactLayout } from "../layout/hierarchyLayout";
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
  const focusId = useBlueprintStore((state) => state.focusId);
  const setFocus = useBlueprintStore((state) => state.setFocus);
  const showAllAtomics = useBlueprintStore((state) => state.showAllAtomics);
  const setShowAllAtomics = useBlueprintStore(
    (state) => state.setShowAllAtomics,
  );
  const positions = useBlueprintStore((state) => state.positions);
  const moveNode = useBlueprintStore((state) => state.moveNode);
  const addEdge = useBlueprintStore((state) => state.addEdge);
  const removeEdge = useBlueprintStore((state) => state.removeEdge);
  const designMode = useBlueprintStore((state) => state.designMode);
  const [hover, setHover] = useState<HoverState | null>(null);
  const instanceRef = useRef<ReactFlowInstance<CircleNodeType, Edge> | null>(
    null,
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of raw?.nodes ?? []) {
      const parent = node.parent_id;
      if (!parent) continue;
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent)!.push(node.id);
    }
    return map;
  }, [raw]);

  const maxLevel = useMemo(() => {
    if (!raw || raw.nodes.length === 0) return 0;
    return Math.max(...raw.nodes.map((node) => node.level));
  }, [raw]);

  // 逐级钻取：默认显示 root + 主干；点主干展开其下一级。创作模式显示全部。
  const displayedRaw = useMemo(() => {
    const nodes = raw?.nodes ?? [];
    if (showAllAtomics) {
      return nodes.filter((node) => node.level === maxLevel);
    }
    if (designMode) return nodes;
    if (!focusId) {
      const roots = nodes.filter((node) => !node.parent_id);
      const ids = new Set<string>();
      for (const root of roots) {
        ids.add(root.id);
        for (const child of childrenOf.get(root.id) ?? []) ids.add(child);
      }
      return nodes.filter((node) => ids.has(node.id));
    }
    const ids = new Set<string>([focusId]);
    for (const child of childrenOf.get(focusId) ?? []) ids.add(child);
    return nodes.filter((node) => ids.has(node.id));
  }, [raw, focusId, designMode, childrenOf, showAllAtomics, maxLevel]);

  const degree = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of raw?.edges ?? []) {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1);
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1);
    }
    return map;
  }, [raw]);

  const laidOut = useMemo(
    () => compactLayout(displayedRaw, positions, degree),
    [displayedRaw, positions, degree],
  );

  const visibleIds = useMemo(
    () => new Set(displayedRaw.map((node) => node.id)),
    [displayedRaw],
  );

  const levelOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of raw?.nodes ?? []) map.set(node.id, node.level);
    return map;
  }, [raw]);

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

  const highlight = useMemo(
    () =>
      computeHighlight(
        (raw?.edges ?? []).filter(
          (edge) =>
            visibleIds.has(edge.source) && visibleIds.has(edge.target),
        ),
        selectedId,
      ),
    [raw, visibleIds, selectedId],
  );

  const displayNodes = useMemo(
    () =>
      laidOut.map((node) => {
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
            groupColor: colorForGroup(groupColors, node.data.raw.group),
          },
        };
      }),
    [laidOut, selectedId, query, groupColors, highlight],
  );

  const displayEdges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    for (const edge of raw?.edges ?? []) {
      // 只要连线两端都可见就显示（含原子功能之间的调用关系）
      if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target))
        continue;
      const id = `${edge.source}->${edge.target}`;
      const isHighlighted = highlight.edges.has(id);
      const groupColor = colorForGroup(
        groupColors,
        groupById.get(edge.source) ?? "",
      );
      const stroke = isHighlighted ? HIGHLIGHT_COLOR : groupColor;
      const sourceLevel = levelOf.get(edge.source) ?? 1;
      const targetLevel = levelOf.get(edge.target) ?? 1;
      // 调用关系边按真实调用方向（调用者→被调用者）显示箭头；其余按层级/模式
      const arrowAtTarget =
        edge.relation === "call"
          ? true
          : designMode
            ? sourceLevel <= targetLevel
            : sourceLevel >= targetLevel;
      const marker = {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 14,
        height: 14,
      };
      result.push({
        id,
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
          // 默认暗线；激活节点后仅高亮其链路，其余更暗
          opacity: selectedId !== null ? (isHighlighted ? 1 : 0.1) : 0.26,
          animationDirection: arrowAtTarget ? "reverse" : "normal",
        },
      });
    }
    for (const node of displayedRaw) {
      const parent = node.parent_id;
      if (!parent || !visibleIds.has(parent)) continue;
      const id = `tree:${parent}->${node.id}`;
      if (result.some((item) => item.id === id)) continue;
      result.push({
        id,
        source: parent,
        target: node.id,
        type: "default",
        selectable: false,
        focusable: false,
        style: {
          stroke: "#5B6472",
          strokeWidth: 1.1,
          strokeDasharray: "4 4",
          opacity: selectedId !== null ? 0.15 : 0.35,
        },
      });
    }
    return result;
  }, [
    raw,
    visibleIds,
    displayedRaw,
    highlight,
    selectedId,
    groupColors,
    groupById,
    levelOf,
    designMode,
  ]);

  const fitKey = `${raw?.project_id ?? 0}:${focusId ?? "root"}:${designMode}:${
    showAllAtomics ? "atoms" : "tree"
  }:${raw?.stats.node_count ?? 0}`;
  useEffect(() => {
    instanceRef.current?.fitView({
      padding: 0.2,
      duration: 300,
      minZoom: 0.2,
      maxZoom: 1,
    });
  }, [fitKey]);

  useEffect(() => {
    if (!selectedId) return;
    const node = laidOut.find((item) => item.id === selectedId);
    if (!node || !instanceRef.current) return;
    const size = NODE_SIZES[node.data.raw.kind] ?? 60;
    instanceRef.current.setCenter(
      node.position.x + size / 2,
      node.position.y + size / 2,
      { zoom: Math.max(instanceRef.current.getZoom(), 0.8), duration: 400 },
    );
  }, [selectedId, laidOut]);

  const handleNodeClick = (node: CircleNodeType) => {
    const hasChildren = (childrenOf.get(node.id)?.length ?? 0) > 0;
    select(node.id);
    if (hasChildren && !designMode) {
      // 根级节点本身等价于「根」视图
      setFocus(node.data.raw.parent_id ? node.id : null);
    }
  };

  const handlePaneClick = () => {
    select(null);
    if (showAllAtomics) {
      setShowAllAtomics(false);
      return;
    }
    // 点空白处返回上一级（逐级回退到 root+主干）
    if (designMode || !focusId) return;
    const current = raw?.nodes.find((node) => node.id === focusId);
    const parentId = current?.parent_id;
    if (!parentId) {
      setFocus(null);
      return;
    }
    const parent = raw?.nodes.find((node) => node.id === parentId);
    setFocus(parent?.parent_id ? parentId : null);
  };

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        minZoom={0.05}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.2, maxZoom: 1 }}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => handleNodeClick(node as CircleNodeType)}
        onNodeDragStop={(_, node) =>
          moveNode(node.id, node.position.x, node.position.y)
        }
        onPaneClick={handlePaneClick}
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
          if (edge.id.startsWith("tree:")) return;
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
      </ReactFlow>

      {status === "idle" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-dashed border-line bg-panel/80 px-6 py-5 text-center">
            <div className="font-mono text-sm text-ink">尚未加载蓝图</div>
            <div className="mt-1 text-xs text-muted">
              在左上角菜单新建项目，或在上方输入项目目录扫描
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
