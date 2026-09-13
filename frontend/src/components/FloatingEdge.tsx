import {
  BaseEdge,
  getBezierPath,
  Position,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boxOf(node: {
  internals: { positionAbsolute: { x: number; y: number } };
  measured?: { width?: number; height?: number };
}): Box {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    w: node.measured?.width ?? 60,
    h: node.measured?.height ?? 60,
  };
}

/** 从圆心朝目标方向，与圆圈边缘的交点 */
function circlePoint(box: Box, toward: { x: number; y: number }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const radius = Math.min(box.w, box.h) / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const length = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / length) * radius, y: cy + (dy / length) * radius };
}

function sideOf(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left;
  }
  return dy > 0 ? Position.Bottom : Position.Top;
}

/**
 * 浮动连线：按两个圆圈彼此的朝向自动选择接入点（圆圈任意位置），
 * 并用平滑贝塞尔曲线连接，避免急转弯。
 */
export default function FloatingEdge({
  id,
  source,
  target,
  style,
  markerEnd,
  markerStart,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sourceBox = boxOf(sourceNode);
  const targetBox = boxOf(targetNode);
  const sourceCenter = {
    x: sourceBox.x + sourceBox.w / 2,
    y: sourceBox.y + sourceBox.h / 2,
  };
  const targetCenter = {
    x: targetBox.x + targetBox.w / 2,
    y: targetBox.y + targetBox.h / 2,
  };
  const sourcePoint = circlePoint(sourceBox, targetCenter);
  const targetPoint = circlePoint(targetBox, sourceCenter);

  const [path] = getBezierPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sideOf(sourceCenter, targetCenter),
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: sideOf(targetCenter, sourceCenter),
    curvature: 0.35,
  });

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={style}
    />
  );
}
