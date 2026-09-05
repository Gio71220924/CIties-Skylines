import { randomUUID } from 'node:crypto';
import type { Cell, Parcel, Point, RoadGraph, ZoneType } from '../../types/grid.js';

const CELL_SIZE = 8; // meters — matches CS1's actual zoning grid unit
const ROAD_ADJACENT_THRESHOLD = 12; // meters; cell counts road-adjacent within this
const TRANSIT_ADJACENT_THRESHOLD = 500; // meters; walk catchment, matches scoreParcel's constant

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polygonBounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
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

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

interface ParcelEntry {
  parcel: Parcel;
  bounds: ReturnType<typeof polygonBounds>;
}

function findOwner(center: Point, entries: ParcelEntry[]): Parcel | null {
  for (const entry of entries) {
    if (
      center.x < entry.bounds.minX ||
      center.x > entry.bounds.maxX ||
      center.y < entry.bounds.minY ||
      center.y > entry.bounds.maxY
    ) {
      continue; // cheap bbox reject before the full point-in-polygon test
    }
    if (isPointInPolygon(center, entry.parcel.polygon)) return entry.parcel;
  }
  return null;
}

function isNearAnyEdge(center: Point, roadGraph: RoadGraph, threshold: number): boolean {
  for (const edge of roadGraph.edges) {
    for (let i = 0; i < edge.polyline.length - 1; i++) {
      if (distanceToSegment(center, edge.polyline[i], edge.polyline[i + 1]) <= threshold) return true;
    }
  }
  return false;
}

// Converts parcel polygons (from blockSubdivider) + the road graph into the 8m cell grid
// the frontend renders as an overlay on top of what the player builds in-game.
export function rasterizeTileToGrid(
  tileId: string,
  tileBoundary: Point[],
  parcels: Parcel[],
  roadGraph: RoadGraph,
  transitStopPoints: Point[] = []
): Cell[] {
  const bounds = polygonBounds(tileBoundary);
  const cols = Math.round((bounds.maxX - bounds.minX) / CELL_SIZE);
  const rows = Math.round((bounds.maxY - bounds.minY) / CELL_SIZE);
  const parcelEntries: ParcelEntry[] = parcels.map((parcel) => ({ parcel, bounds: polygonBounds(parcel.polygon) }));

  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const center: Point = {
        x: bounds.minX + (col + 0.5) * CELL_SIZE,
        y: bounds.minY + (row + 0.5) * CELL_SIZE,
      };

      const owner = findOwner(center, parcelEntries);
      const zoneType: ZoneType = owner?.suggestedZoneType ?? 'none';
      const roadAdjacent = isNearAnyEdge(center, roadGraph, ROAD_ADJACENT_THRESHOLD);
      const transitAdjacent = transitStopPoints.some((s) => distance(center, s) <= TRANSIT_ADJACENT_THRESHOLD);

      cells.push({
        id: randomUUID(),
        tileId,
        localX: col,
        localY: row,
        zoneType,
        isRecommended: zoneType !== 'none',
        roadAdjacent,
        transitAdjacent,
      });
    }
  }

  return cells;
}
