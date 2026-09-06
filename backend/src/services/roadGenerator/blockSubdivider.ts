import { randomUUID } from 'node:crypto';
import { polygonize, lineString, featureCollection } from '@turf/turf';
import type { Point, Parcel, RoadGraph } from '../../types/grid.js';

interface SubdivideParams {
  cbdCenter: Point;
  cbdRadius: number; // inside this radius, use blockSizeCBD
  transitionRadius: number; // beyond this radius, use blockSizeSuburb (lerp in between)
  blockSizeCBD: number; // target parcel area (m^2)
  blockSizeSuburb: number;
  maxSplitDepth: number;
}

// --- polygon geometry helpers (Cartesian, not geographic — turf's lon/lat math is unused here) ---

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonBounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function polygonCentroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

// Sutherland-Hodgman clip against a single half-plane (axis-aligned split line).
function clipHalfPlane(points: Point[], keep: (p: Point) => boolean, lerp: (a: Point, b: Point) => Point): Point[] {
  const output: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const currentIn = keep(current);
    const prevIn = keep(prev);
    if (currentIn) {
      if (!prevIn) output.push(lerp(prev, current));
      output.push(current);
    } else if (prevIn) {
      output.push(lerp(prev, current));
    }
  }
  return output;
}

function lerpAtX(splitX: number) {
  return (a: Point, b: Point): Point => {
    const t = (splitX - a.x) / (b.x - a.x);
    return { x: splitX, y: a.y + t * (b.y - a.y) };
  };
}

function lerpAtY(splitY: number) {
  return (a: Point, b: Point): Point => {
    const t = (splitY - a.y) / (b.y - a.y);
    return { x: a.x + t * (b.x - a.x), y: splitY };
  };
}

// Recursively halve a block along its longer bounding-box axis until it's under targetArea.
function subdivide(points: Point[], targetArea: number, depth: number, maxDepth: number): Point[][] {
  if (points.length < 3) return [];
  if (polygonArea(points) <= targetArea || depth >= maxDepth) return [points];

  const bounds = polygonBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  let a: Point[];
  let b: Point[];
  if (width >= height) {
    const splitX = (bounds.minX + bounds.maxX) / 2;
    const lerp = lerpAtX(splitX);
    a = clipHalfPlane(points, (p) => p.x <= splitX, lerp);
    b = clipHalfPlane(points, (p) => p.x >= splitX, lerp);
  } else {
    const splitY = (bounds.minY + bounds.maxY) / 2;
    const lerp = lerpAtY(splitY);
    a = clipHalfPlane(points, (p) => p.y <= splitY, lerp);
    b = clipHalfPlane(points, (p) => p.y >= splitY, lerp);
  }

  // A split that fails to make progress (e.g. degenerate sliver) — stop recursing on that half.
  if (a.length < 3 || b.length < 3) return [points];

  return [...subdivide(a, targetArea, depth + 1, maxDepth), ...subdivide(b, targetArea, depth + 1, maxDepth)];
}

function targetAreaFor(centroid: Point, params: SubdivideParams): number {
  const dist = Math.hypot(centroid.x - params.cbdCenter.x, centroid.y - params.cbdCenter.y);
  if (dist <= params.cbdRadius) return params.blockSizeCBD;
  if (dist >= params.transitionRadius) return params.blockSizeSuburb;
  const t = (dist - params.cbdRadius) / (params.transitionRadius - params.cbdRadius);
  return params.blockSizeCBD + t * (params.blockSizeSuburb - params.blockSizeCBD);
}

export function subdivideIntoParcels(
  roadGraph: RoadGraph,
  tileBoundary: Point[],
  tileId: string,
  params: SubdivideParams
): Parcel[] {
  // Feed both road edges and the tile boundary into polygonize — the boundary closes off
  // blocks that back onto the tile edge, and dangling stub edges (unconnected neighbor
  // tile) are dropped automatically by turf's graph cleanup, leaving that area unclaimed
  // until the neighbor tile unlocks and the road actually connects.
  //
  // With multiple independent seed points (spread across the tile so road coverage
  // actually reaches the whole area), edges from different clusters occasionally cross
  // or snap near-coincidentally, producing a near-zero-length segment that crashes turf's
  // polygonize (EdgeRing.toPolygon throws on a degenerate ring). Drop those before they
  // ever reach turf.
  const MIN_EDGE_LENGTH = 0.5; // meters
  const validEdges = roadGraph.edges.filter((edge) => {
    for (let i = 0; i < edge.polyline.length - 1; i++) {
      const a = edge.polyline[i];
      const b = edge.polyline[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_EDGE_LENGTH) return false;
    }
    return true;
  });

  const lines = [
    ...validEdges.map((edge) => lineString(edge.polyline.map((p) => [p.x, p.y]))),
    ...tileBoundary.map((p, i) => {
      const next = tileBoundary[(i + 1) % tileBoundary.length];
      return lineString([[p.x, p.y], [next.x, next.y]]);
    }),
  ];

  let blocks;
  try {
    blocks = polygonize(featureCollection(lines));
  } catch (err) {
    // Belt-and-suspenders: organic, randomized road geometry can still surprise turf in
    // ways the length filter above doesn't catch — fail this tile's subdivision instead
    // of crashing the whole unlock request.
    console.error('subdivideIntoParcels: polygonize failed, returning no parcels for this tile:', err);
    return [];
  }

  const parcels: Parcel[] = [];
  for (const block of blocks.features) {
    const ring = block.geometry.coordinates[0]; // exterior ring, closed (first === last)
    const points: Point[] = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
    if (points.length < 3) continue;

    const targetArea = targetAreaFor(polygonCentroid(points), params);
    const parts = subdivide(points, targetArea, 0, params.maxSplitDepth);

    for (const part of parts) {
      if (polygonArea(part) < 1) continue; // drop slivers from clipping error
      parcels.push({ id: randomUUID(), tileId, polygon: part, suggestedZoneType: null, score: 0 });
    }
  }

  return parcels;
}
