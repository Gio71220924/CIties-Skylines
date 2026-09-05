import type { Parcel, Point, RoadGraph, RoadSegment, StyleConfig, TransitStop, ZoneType } from '../../types/grid.js';

export interface DemandStats {
  population: number;
  jobs: number;
}

export interface ScoringContext {
  roadGraph: RoadGraph;
  transitStops: TransitStop[];
  neighborParcels: Parcel[]; // parcels with a zoneType already assigned (this tile + adjacent)
  demand: DemandStats;
  style: StyleConfig;
}

// Weights not exposed via StyleConfig (that only tunes the car-centric/transit-oriented
// road<->transit balance) — proximity clustering, jobs/housing demand, and the
// industry/residential incompatibility penalty stay fixed across presets.
const PROXIMITY_WEIGHT = 0.2;
const DEMAND_WEIGHT = 0.25;
const INCOMPATIBILITY_WEIGHT = 0.3;

const ROAD_DECAY_DISTANCE = 60; // meters; parcel scores ~0 road access past this
const TRANSIT_DECAY_DISTANCE = 500; // meters; typical walk catchment
const CLUSTER_RADIUS = 150; // meters; neighbor search radius for proximity/incompatibility
const TARGET_JOBS_PER_CAPITA = 0.5;

const JOB_PRODUCING: ZoneType[] = ['comm_low', 'comm_high', 'office', 'industry'];
const RESIDENTIAL: ZoneType[] = ['resi_low', 'resi_high'];
const HIGH_DENSITY: ZoneType[] = ['resi_high', 'comm_high', 'office'];

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function nearestEdgeDistance(point: Point, roadGraph: RoadGraph, filter: (e: RoadSegment) => boolean): number {
  let best = Infinity;
  for (const edge of roadGraph.edges) {
    if (!filter(edge)) continue;
    for (let i = 0; i < edge.polyline.length - 1; i++) {
      const d = distanceToSegment(point, edge.polyline[i], edge.polyline[i + 1]);
      if (d < best) best = d;
    }
  }
  return best;
}

function decayScore(dist: number, decayDistance: number): number {
  if (!Number.isFinite(dist)) return 0;
  return Math.max(0, 1 - dist / decayDistance);
}

function roadAccessScore(center: Point, zoneType: ZoneType, roadGraph: RoadGraph): number {
  if (zoneType === 'industry') {
    // Industry cares specifically about arterial/highway access for cargo.
    const arterialDist = nearestEdgeDistance(center, roadGraph, (e) => e.type === 'arterial');
    return decayScore(arterialDist, ROAD_DECAY_DISTANCE * 1.5);
  }
  const anyRoadDist = nearestEdgeDistance(center, roadGraph, () => true);
  return decayScore(anyRoadDist, ROAD_DECAY_DISTANCE);
}

function transitAccessScore(center: Point, zoneType: ZoneType, stops: TransitStop[], style: StyleConfig): number {
  if (stops.length === 0) return 0;
  const nearest = Math.min(...stops.map((s) => distance(center, s.point)));
  const base = decayScore(nearest, TRANSIT_DECAY_DISTANCE);
  return HIGH_DENSITY.includes(zoneType) ? Math.min(1, base * style.zoningWeights.densityNearTransitBonus) : base;
}

function proximityToSimilarZoneScore(center: Point, zoneType: ZoneType, neighbors: Parcel[]): number {
  const nearby = neighbors.filter((n) => n.suggestedZoneType && distance(center, centroid(n.polygon)) <= CLUSTER_RADIUS);
  if (nearby.length === 0) return 0;
  const sameFamily = nearby.filter((n) => sameZoneFamily(n.suggestedZoneType as ZoneType, zoneType));
  return sameFamily.length / nearby.length;
}

function sameZoneFamily(a: ZoneType, b: ZoneType): boolean {
  if (a === b) return true;
  const familyOf = (z: ZoneType) => (RESIDENTIAL.includes(z) ? 'resi' : JOB_PRODUCING.includes(z) ? 'job' : z);
  return familyOf(a) === familyOf(b);
}

function demandRatioScore(zoneType: ZoneType, demand: DemandStats): number {
  const currentRatio = demand.jobs / Math.max(demand.population, 1);
  const deficit = (TARGET_JOBS_PER_CAPITA - currentRatio) / TARGET_JOBS_PER_CAPITA; // >0 = need jobs, <0 = need housing

  if (JOB_PRODUCING.includes(zoneType)) return Math.max(0, Math.min(1, deficit));
  if (RESIDENTIAL.includes(zoneType)) return Math.max(0, Math.min(1, -deficit));
  return 0.5; // park: not demand-driven in this MVP pass
}

function incompatibilityPenalty(center: Point, zoneType: ZoneType, neighbors: Parcel[]): number {
  const nearby = neighbors.filter((n) => n.suggestedZoneType && distance(center, centroid(n.polygon)) <= CLUSTER_RADIUS);
  if (zoneType === 'industry') {
    const nearResi = nearby.filter((n) => RESIDENTIAL.includes(n.suggestedZoneType as ZoneType)).length;
    return nearby.length === 0 ? 0 : nearResi / nearby.length;
  }
  if (RESIDENTIAL.includes(zoneType)) {
    const nearIndustry = nearby.filter((n) => n.suggestedZoneType === 'industry').length;
    return nearby.length === 0 ? 0 : nearIndustry / nearby.length;
  }
  return 0;
}

export function scoreParcel(parcel: Parcel, zoneType: ZoneType, context: ScoringContext): number {
  if (zoneType === 'none') return 0;

  const center = centroid(parcel.polygon);
  const { style } = context;

  const road = roadAccessScore(center, zoneType, context.roadGraph);
  const transit = transitAccessScore(center, zoneType, context.transitStops, style);
  const proximity = proximityToSimilarZoneScore(center, zoneType, context.neighborParcels);
  const demandScore = demandRatioScore(zoneType, context.demand);
  const penalty = incompatibilityPenalty(center, zoneType, context.neighborParcels);

  const score =
    style.zoningWeights.roadAccessWeight * road +
    style.zoningWeights.transitAccessWeight * transit +
    PROXIMITY_WEIGHT * proximity +
    DEMAND_WEIGHT * demandScore -
    INCOMPATIBILITY_WEIGHT * penalty;

  return Math.max(0, score);
}

const SCORABLE_ZONE_TYPES: ZoneType[] = ['resi_low', 'resi_high', 'comm_low', 'comm_high', 'office', 'industry', 'park'];

export function scoreAllZoneTypes(parcel: Parcel, context: ScoringContext): Record<ZoneType, number> {
  return Object.fromEntries(
    SCORABLE_ZONE_TYPES.map((zt) => [zt, scoreParcel(parcel, zt, context)])
  ) as Record<ZoneType, number>;
}

export function bestZoneType(parcel: Parcel, context: ScoringContext): { zoneType: ZoneType; score: number } {
  const scores = scoreAllZoneTypes(parcel, context);
  let best: ZoneType = 'none';
  let bestScore = -Infinity;
  for (const zt of SCORABLE_ZONE_TYPES) {
    if (scores[zt] > bestScore) {
      best = zt;
      bestScore = scores[zt];
    }
  }
  return { zoneType: best, score: bestScore };
}
