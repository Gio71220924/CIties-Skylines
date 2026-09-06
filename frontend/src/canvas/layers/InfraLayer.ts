import { Graphics } from 'pixi.js';
import type { Point, RoadGraph, RoadNode, RoadSegment } from '../../types/grid';

const ARTERIAL_COLOR = 0xffcc66;
const LOCAL_COLOR = 0xaaaaaa;
const CURVE_STRENGTH = 1 / 3; // fraction of segment length used as bezier handle length

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

// Direction from `node`, averaged across all its OTHER connected edges (excluding
// excludeEdgeId), pointing toward those neighbors — i.e. "which way the road continues
// on the other side of this junction." Used to bend this edge's curve so it flows as a
// smooth continuation of whatever else passes through the node, instead of every edge
// being rendered as an isolated straight segment with a sharp corner at every junction.
function continuationDirection(
  node: RoadNode,
  excludeEdgeId: string,
  edgesById: Map<string, RoadSegment>,
  pointById: Map<string, Point>
): Point | null {
  let sum = { x: 0, y: 0 };
  let count = 0;
  for (const edgeId of node.connections) {
    if (edgeId === excludeEdgeId) continue;
    const edge = edgesById.get(edgeId);
    if (!edge) continue;
    const otherId = edge.fromNodeId === node.id ? edge.toNodeId : edge.fromNodeId;
    const otherPoint = pointById.get(otherId);
    if (!otherPoint) continue;
    const dir = normalize({ x: otherPoint.x - node.point.x, y: otherPoint.y - node.point.y });
    sum.x += dir.x;
    sum.y += dir.y;
    count++;
  }
  return count === 0 ? null : normalize(sum);
}

export function renderInfraLayer(graphics: Graphics, roadGraph: RoadGraph): void {
  graphics.clear();
  const nodesById = new Map(roadGraph.nodes.map((n) => [n.id, n]));
  const pointById = new Map(roadGraph.nodes.map((n) => [n.id, n.point]));
  const edgesById = new Map(roadGraph.edges.map((e) => [e.id, e]));

  for (const edge of roadGraph.edges) {
    if (edge.polyline.length < 2) continue;
    const width = edge.type === 'arterial' ? 6 : 3;
    const color = edge.type === 'arterial' ? ARTERIAL_COLOR : LOCAL_COLOR;

    const a = edge.polyline[0];
    const b = edge.polyline[edge.polyline.length - 1];
    const dirAB = normalize({ x: b.x - a.x, y: b.y - a.y });
    const handleLength = distance(a, b) * CURVE_STRENGTH;

    const fromNode = nodesById.get(edge.fromNodeId);
    const toNode = nodesById.get(edge.toNodeId);

    // Curve leaves A opposite of wherever A's other roads continue (so this edge flows as
    // a smooth continuation of whatever passes through A), falling back to a straight line
    // toward B when A is a dead end.
    const contA = fromNode ? continuationDirection(fromNode, edge.id, edgesById, pointById) : null;
    const tanA = contA ? { x: -contA.x, y: -contA.y } : dirAB;

    // Curve arrives at B heading toward wherever B's other roads continue.
    const contB = toNode ? continuationDirection(toNode, edge.id, edgesById, pointById) : null;
    const tanB = contB ?? dirAB;

    const cp1 = { x: a.x + tanA.x * handleLength, y: a.y + tanA.y * handleLength };
    const cp2 = { x: b.x - tanB.x * handleLength, y: b.y - tanB.y * handleLength };

    graphics.moveTo(a.x, a.y);
    graphics.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    graphics.stroke({ width, color, cap: 'round', join: 'round' });
  }
}
