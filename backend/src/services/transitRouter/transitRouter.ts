import { randomUUID } from 'node:crypto';
import type { Point, RoadGraph, RoadNode, RoadSegment, StyleConfig, TransitLine, TransitStop } from '../../types/grid.js';

export interface DensityNode {
  id: string;
  point: Point;
  projectedPopulation: number;
  projectedJobs: number;
}

const MIN_CORRIDOR_DISTANCE = 300; // meters; skip pairs too close to bother with a line
const MAX_CORRIDOR_DISTANCE = 5000; // meters; skip pairs beyond ~one tile's reach
const MAX_NODE_USAGE = 3; // cap how many corridors can share the same density node

// --- geometry helpers -----------------------------------------------------

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polylineLength(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) sum += distance(points[i], points[i + 1]);
  return sum;
}

function nearestNode(point: Point, nodes: RoadNode[]): RoadNode | null {
  if (nodes.length === 0) return null;
  let best = nodes[0];
  let bestDist = distance(point, best.point);
  for (let i = 1; i < nodes.length; i++) {
    const d = distance(point, nodes[i].point);
    if (d < bestDist) {
      best = nodes[i];
      bestDist = d;
    }
  }
  return best;
}

// --- demand corridors (gravity model) --------------------------------------

interface CorridorCandidate {
  a: DensityNode;
  b: DensityNode;
  demand: number;
}

function demandBetween(a: DensityNode, b: DensityNode): number {
  const d = distance(a.point, b.point);
  return ((a.projectedPopulation + a.projectedJobs) * (b.projectedPopulation + b.projectedJobs)) / (d * d);
}

function findTopCorridors(nodes: DensityNode[], topN: number): CorridorCandidate[] {
  const candidates: CorridorCandidate[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = distance(nodes[i].point, nodes[j].point);
      if (d < MIN_CORRIDOR_DISTANCE || d > MAX_CORRIDOR_DISTANCE) continue;
      candidates.push({ a: nodes[i], b: nodes[j], demand: demandBetween(nodes[i], nodes[j]) });
    }
  }
  candidates.sort((x, y) => y.demand - x.demand);

  // Greedy pick, capping reuse per node so demand doesn't collapse onto one cluster's pairs.
  const usage = new Map<string, number>();
  const picked: CorridorCandidate[] = [];
  for (const c of candidates) {
    if (picked.length >= topN) break;
    const usedA = usage.get(c.a.id) ?? 0;
    const usedB = usage.get(c.b.id) ?? 0;
    if (usedA >= MAX_NODE_USAGE || usedB >= MAX_NODE_USAGE) continue;
    picked.push(c);
    usage.set(c.a.id, usedA + 1);
    usage.set(c.b.id, usedB + 1);
  }
  return picked;
}

// --- routing (A*, arterial-preferred) --------------------------------------

interface AdjEdge {
  to: string;
  edgeId: string;
  weight: number;
}

function buildAdjacency(roadGraph: RoadGraph): Map<string, AdjEdge[]> {
  const adjacency = new Map<string, AdjEdge[]>();
  const add = (from: string, e: AdjEdge) => {
    const list = adjacency.get(from);
    if (list) list.push(e);
    else adjacency.set(from, [e]);
  };
  for (const edge of roadGraph.edges) {
    const length = polylineLength(edge.polyline);
    const weight = edge.type === 'arterial' ? length : length * 2.5;
    add(edge.fromNodeId, { to: edge.toNodeId, edgeId: edge.id, weight });
    add(edge.toNodeId, { to: edge.fromNodeId, edgeId: edge.id, weight });
  }
  return adjacency;
}

interface RoutedCorridor {
  edges: RoadSegment[];
  demand: number;
}

function routeCorridor(from: Point, to: Point, roadGraph: RoadGraph, demand: number): RoutedCorridor | null {
  const startNode = nearestNode(from, roadGraph.nodes);
  const endNode = nearestNode(to, roadGraph.nodes);
  if (!startNode || !endNode || startNode.id === endNode.id) return null;

  const adjacency = buildAdjacency(roadGraph);
  const edgesById = new Map(roadGraph.edges.map((e) => [e.id, e]));
  const nodesById = new Map(roadGraph.nodes.map((n) => [n.id, n]));
  const h = (id: string) => distance(nodesById.get(id)!.point, endNode.point);

  const gScore = new Map<string, number>([[startNode.id, 0]]);
  const cameFrom = new Map<string, { nodeId: string; edgeId: string }>();
  const open = new Set<string>([startNode.id]);
  const closed = new Set<string>();

  while (open.size > 0) {
    let current: string | null = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = (gScore.get(id) ?? Infinity) + h(id);
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }
    if (current === null) break;

    if (current === endNode.id) {
      const edges: RoadSegment[] = [];
      let cur = current;
      while (cameFrom.has(cur)) {
        const step = cameFrom.get(cur)!;
        edges.push(edgesById.get(step.edgeId)!);
        cur = step.nodeId;
      }
      edges.reverse();
      return { edges, demand };
    }

    open.delete(current);
    closed.add(current);

    for (const adj of adjacency.get(current) ?? []) {
      if (closed.has(adj.to)) continue;
      const tentativeG = (gScore.get(current) ?? Infinity) + adj.weight;
      if (tentativeG < (gScore.get(adj.to) ?? Infinity)) {
        gScore.set(adj.to, tentativeG);
        cameFrom.set(adj.to, { nodeId: current, edgeId: adj.edgeId });
        open.add(adj.to);
      }
    }
  }

  return null; // disconnected graph — road generation didn't reach between these two points
}

// --- consolidation (merge overlapping routed corridors into single lines) --

function sharedEdgeRatio(a: RoadSegment[], b: RoadSegment[]): number {
  const idsA = new Set(a.map((e) => e.id));
  const shared = b.filter((e) => idsA.has(e.id)).length;
  const minLen = Math.min(a.length, b.length) || 1;
  return shared / minLen;
}

function mergeEdgeUnion(a: RoadSegment[], b: RoadSegment[]): RoadSegment[] {
  const seen = new Set(a.map((e) => e.id));
  const merged = [...a];
  for (const e of b) {
    if (!seen.has(e.id)) {
      merged.push(e);
      seen.add(e.id);
    }
  }
  return merged;
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

function consolidateCorridors(routed: RoutedCorridor[], overlapThreshold: number): RoutedCorridor[] {
  const uf = new UnionFind(routed.length);
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      if (sharedEdgeRatio(routed[i].edges, routed[j].edges) > overlapThreshold) uf.union(i, j);
    }
  }

  const groups = new Map<number, RoutedCorridor>();
  for (let i = 0; i < routed.length; i++) {
    const root = uf.find(i);
    const existing = groups.get(root);
    if (!existing) {
      groups.set(root, { edges: routed[i].edges, demand: routed[i].demand });
    } else {
      groups.set(root, { edges: mergeEdgeUnion(existing.edges, routed[i].edges), demand: existing.demand + routed[i].demand });
    }
  }
  return [...groups.values()];
}

// --- stop placement ---------------------------------------------------------

function buildLineStops(edges: RoadSegment[], spacing: number): TransitStop[] {
  const points = edges.flatMap((e) => e.polyline);
  if (points.length === 0) return [];

  const makeStop = (point: Point, nearestNodeId: string): TransitStop => ({
    id: randomUUID(),
    point,
    nearestNodeId,
    lineIds: [],
  });

  const stops: TransitStop[] = [makeStop(points[0], edges[0].fromNodeId)];
  let accumulated = 0;
  for (let i = 0; i < points.length - 1; i++) {
    accumulated += distance(points[i], points[i + 1]);
    if (accumulated >= spacing) {
      const edgeIndex = Math.min(i, edges.length - 1);
      stops.push(makeStop(points[i + 1], edges[edgeIndex].toNodeId));
      accumulated = 0;
    }
  }

  const last = points[points.length - 1];
  if (distance(stops[stops.length - 1].point, last) > 1) {
    stops.push(makeStop(last, edges[edges.length - 1].toNodeId));
  }
  return stops;
}

// --- dedupe against a previous generation ------------------------------------

function mergeWithExisting(newLines: TransitLine[], existingLines: TransitLine[], overlapThreshold: number): TransitLine[] {
  const merged = [...existingLines];
  for (const line of newLines) {
    const isDuplicate = existingLines.some((existing) => sharedEdgeRatio(existing.roadPath, line.roadPath) > overlapThreshold);
    if (!isDuplicate) merged.push(line);
  }
  return merged;
}

// --- entry point --------------------------------------------------------

export function generateTransitNetwork(
  roadGraph: RoadGraph,
  densityMap: DensityNode[],
  style: StyleConfig,
  existingLines: TransitLine[] = []
): TransitLine[] {
  const corridors = findTopCorridors(densityMap, style.transit.corridorCount);

  const routed: RoutedCorridor[] = [];
  for (const corridor of corridors) {
    const result = routeCorridor(corridor.a.point, corridor.b.point, roadGraph, corridor.demand);
    if (result) routed.push(result);
  }
  if (routed.length === 0) return [...existingLines].sort((a, b) => b.demandScore - a.demandScore);

  const consolidated = consolidateCorridors(routed, style.transit.overlapThreshold);
  const newLines: TransitLine[] = consolidated.map((c) => ({
    id: randomUUID(),
    mode: 'bus',
    roadPath: c.edges,
    stops: buildLineStops(c.edges, style.transit.stopSpacing),
    demandScore: c.demand,
  }));

  return mergeWithExisting(newLines, existingLines, style.transit.overlapThreshold).sort(
    (a, b) => b.demandScore - a.demandScore
  );
}
