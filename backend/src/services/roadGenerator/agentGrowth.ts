import { randomUUID } from 'node:crypto';
import type { Point, RoadGraph, RoadNode, RoadSegment, RoadType, StyleConfig } from '../../types/grid.js';

interface GrowthParams {
  arterialLength: number;
  localLength: number;
  branchIntervalArterial: number;
  branchAngleRange: [number, number];
  angleJitter: number;
  snapRadius: number;
  maxDepth: number;
  maxIterations: number;
}

const DEFAULT_PARAMS: GrowthParams = {
  arterialLength: 120,
  localLength: 40,
  branchIntervalArterial: 3,
  branchAngleRange: [70, 110],
  angleJitter: 15,
  snapRadius: 15,
  maxDepth: 6,
  maxIterations: 4000,
};

interface ProposedSegment {
  start: Point;
  end: Point;
  type: RoadType;
  depth: number;
}

// --- geometry helpers ------------------------------------------------------

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function angleOf(a: Point, b: Point): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function pointAt(origin: Point, angleDeg: number, length: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: origin.x + Math.cos(rad) * length, y: origin.y + Math.sin(rad) * length };
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomSign(): 1 | -1 {
  return Math.random() < 0.5 ? 1 : -1;
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonEdges(polygon: Point[]): [Point, Point][] {
  return polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]] as [Point, Point]);
}

// Returns the intersection point of segment p1-p2 and p3-p4, excluding shared endpoints.
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel or coincident

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
    return { x: p1.x + t * d1x, y: p1.y + t * d1y };
  }
  return null;
}

// --- growing network state --------------------------------------------------
// Holds nodes/edges as they're committed and handles snap-to-node / intersection-split,
// so two tiles' stub roads (or two branches within one tile) meet at a shared junction
// instead of floating disconnected segments.

class RoadNetworkBuilder {
  nodes: RoadNode[] = [];
  edges: RoadSegment[] = [];

  findNodeWithin(point: Point, radius: number): RoadNode | null {
    let closest: RoadNode | null = null;
    let closestDist = radius;
    for (const node of this.nodes) {
      const d = distance(node.point, point);
      if (d <= closestDist) {
        closest = node;
        closestDist = d;
      }
    }
    return closest;
  }

  findIntersection(start: Point, end: Point): { point: Point; edge: RoadSegment } | null {
    for (const edge of this.edges) {
      const a = this.nodeById(edge.fromNodeId).point;
      const b = this.nodeById(edge.toNodeId).point;
      const hit = segmentsIntersect(start, end, a, b);
      if (hit) return { point: hit, edge };
    }
    return null;
  }

  nodeById(id: string): RoadNode {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`road network: unknown node id ${id}`);
    return node;
  }

  private getOrCreateNode(point: Point, snapRadius: number): RoadNode {
    const existing = this.findNodeWithin(point, snapRadius);
    if (existing) return existing;
    const node: RoadNode = { id: randomUUID(), point, connections: [], isStub: false, facingTileCoord: null };
    this.nodes.push(node);
    return node;
  }

  // Splits an existing edge at `point`, replacing it with two edges joined at a new junction node.
  splitEdgeAt(edge: RoadSegment, point: Point): RoadNode {
    const fromNode = this.nodeById(edge.fromNodeId);
    const toNode = this.nodeById(edge.toNodeId);

    this.edges = this.edges.filter((e) => e.id !== edge.id);
    fromNode.connections = fromNode.connections.filter((id) => id !== edge.id);
    toNode.connections = toNode.connections.filter((id) => id !== edge.id);

    const junction: RoadNode = { id: randomUUID(), point, connections: [], isStub: false, facingTileCoord: null };
    this.nodes.push(junction);

    const seg1: RoadSegment = {
      id: randomUUID(),
      fromNodeId: fromNode.id,
      toNodeId: junction.id,
      type: edge.type,
      polyline: [fromNode.point, junction.point],
      depth: edge.depth,
    };
    const seg2: RoadSegment = {
      id: randomUUID(),
      fromNodeId: junction.id,
      toNodeId: toNode.id,
      type: edge.type,
      polyline: [junction.point, toNode.point],
      depth: edge.depth,
    };
    this.edges.push(seg1, seg2);
    fromNode.connections.push(seg1.id);
    junction.connections.push(seg1.id, seg2.id);
    toNode.connections.push(seg2.id);

    return junction;
  }

  commit(start: Point, end: Point, type: RoadType, depth: number, snapRadius: number): RoadNode {
    const startNode = this.getOrCreateNode(start, snapRadius);
    const endNode = this.getOrCreateNode(end, snapRadius);

    const segment: RoadSegment = {
      id: randomUUID(),
      fromNodeId: startNode.id,
      toNodeId: endNode.id,
      type,
      polyline: [startNode.point, endNode.point],
      depth,
    };
    this.edges.push(segment);
    startNode.connections.push(segment.id);
    endNode.connections.push(segment.id);
    return endNode;
  }
}

// --- local constraint check --------------------------------------------------

function legalize(
  seg: ProposedSegment,
  builder: RoadNetworkBuilder,
  tileBoundary: Point[],
  terrainMask: Point[][],
  params: GrowthParams
): ProposedSegment | null {
  if (!isPointInPolygon(seg.end, tileBoundary)) return null;

  for (const mask of terrainMask) {
    if (isPointInPolygon(seg.end, mask)) return null;
    for (const [a, b] of polygonEdges(mask)) {
      if (segmentsIntersect(seg.start, seg.end, a, b)) return null;
    }
  }

  const nearbyNode = builder.findNodeWithin(seg.end, params.snapRadius);
  if (nearbyNode) {
    return { ...seg, end: nearbyNode.point };
  }

  const hit = builder.findIntersection(seg.start, seg.end);
  if (hit) {
    return { ...seg, end: hit.point };
  }

  return seg;
}

// --- branching rule ------------------------------------------------------

function proposeNext(seg: ProposedSegment, params: GrowthParams): ProposedSegment[] {
  const results: ProposedSegment[] = [];
  if (seg.depth >= params.maxDepth) return results;

  const baseAngle = angleOf(seg.start, seg.end);
  const length = seg.type === 'arterial' ? params.arterialLength : params.localLength;

  const jitter = randomRange(-params.angleJitter, params.angleJitter);
  const continueEnd = pointAt(seg.end, baseAngle + jitter, length);
  results.push({ start: seg.end, end: continueEnd, type: seg.type, depth: seg.depth + 1 });

  if (seg.type === 'arterial' && seg.depth % params.branchIntervalArterial === 0) {
    const [minAngle, maxAngle] = params.branchAngleRange;
    const branchAngle = baseAngle + randomRange(minAngle, maxAngle) * randomSign();
    const branchEnd = pointAt(seg.end, branchAngle, params.localLength);
    results.push({ start: seg.end, end: branchEnd, type: 'local', depth: seg.depth + 1 });
  }

  return results;
}

function priorityOf(seg: ProposedSegment): number {
  // Arterial segments are legalized/committed before local branches at the same depth.
  return (seg.type === 'arterial' ? 0 : 1000) + seg.depth;
}

// --- entry point ------------------------------------------------------

function paramsFromStyle(style: StyleConfig, overrides: Partial<GrowthParams>): GrowthParams {
  return {
    ...DEFAULT_PARAMS,
    arterialLength: style.road.arterialSpacing,
    localLength: Math.max(20, style.road.blockSizeSuburb / 4),
    ...overrides,
  };
}

export function generateRoads(
  seedPoints: Point[],
  tileBoundary: Point[],
  terrainMask: Point[][],
  style: StyleConfig,
  paramsOverride: Partial<GrowthParams> = {}
): RoadGraph {
  const params = paramsFromStyle(style, paramsOverride);
  const builder = new RoadNetworkBuilder();
  const queue: ProposedSegment[] = [];

  for (const seed of seedPoints) {
    const angle = randomRange(0, 360);
    queue.push({ start: seed, end: pointAt(seed, angle, params.arterialLength), type: 'arterial', depth: 0 });
  }

  let iterations = 0;
  while (queue.length > 0 && iterations < params.maxIterations) {
    iterations += 1;
    queue.sort((a, b) => priorityOf(a) - priorityOf(b));
    const proposed = queue.shift() as ProposedSegment;

    const legalized = legalize(proposed, builder, tileBoundary, terrainMask, params);
    if (!legalized) continue;

    builder.commit(legalized.start, legalized.end, legalized.type, legalized.depth, params.snapRadius);
    queue.push(...proposeNext(legalized, params));
  }

  return { nodes: builder.nodes, edges: builder.edges };
}
