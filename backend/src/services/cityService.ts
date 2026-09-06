import type { Cell, Parcel, Point, RoadGraph, StyleConfig, Tile, TransitLine, ZoneType } from '../types/grid.js';
import { generateRoads } from './roadGenerator/agentGrowth.js';
import { subdivideIntoParcels } from './roadGenerator/blockSubdivider.js';
import { bestZoneType } from './zoningScorer/scoreParcel.js';
import { generateTransitNetwork, type DensityNode } from './transitRouter/transitRouter.js';
import { rasterizeTileToGrid } from './rasterizer/gridOverlay.js';

export const GRID_SIZE = 5; // CS1: fixed 5x5 tile grid
export const TILE_SIZE = 2000; // meters, CS1 tile is 2km x 2km

export interface CityState {
  tiles: Tile[];
  roadGraph: RoadGraph;
  parcels: Parcel[];
  cells: Cell[];
  transitLines: TransitLine[];
  demand: { population: number; jobs: number };
}

export function createCityState(): CityState {
  return {
    tiles: [],
    roadGraph: { nodes: [], edges: [] },
    parcels: [],
    cells: [],
    transitLines: [],
    demand: { population: 0, jobs: 0 },
  };
}

export function tileBoundaryFor(gridX: number, gridY: number): Point[] {
  const x0 = gridX * TILE_SIZE;
  const y0 = gridY * TILE_SIZE;
  return [
    { x: x0, y: y0 },
    { x: x0 + TILE_SIZE, y: y0 },
    { x: x0 + TILE_SIZE, y: y0 + TILE_SIZE },
    { x: x0, y: y0 + TILE_SIZE },
  ];
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// TODO: replace with proper isStub/facingTileCoord bookkeeping (multi-tile design) once
// agentGrowth marks boundary-crossing nodes. Pragmatic MVP: any existing road node close
// to the new tile's boundary counts as a connection point for the new tile to grow from.
function findSeedPoints(roadGraph: RoadGraph, boundary: Point[]): Point[] {
  const threshold = 50;
  const seeds: Point[] = [];
  for (const node of roadGraph.nodes) {
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      if (distanceToSegment(node.point, a, b) <= threshold) {
        seeds.push(node.point);
        break;
      }
    }
  }
  return seeds;
}

// Rough population/jobs-per-m2 used only to turn zoning recommendations into a demand
// signal for the transit router's gravity model — not a simulation, just enough to make
// "denser area -> more corridor demand" hold.
const ZONE_DENSITY: Partial<Record<ZoneType, { populationPerM2: number; jobsPerM2: number }>> = {
  resi_low: { populationPerM2: 0.02, jobsPerM2: 0 },
  resi_high: { populationPerM2: 0.08, jobsPerM2: 0 },
  comm_low: { populationPerM2: 0, jobsPerM2: 0.015 },
  comm_high: { populationPerM2: 0, jobsPerM2: 0.05 },
  office: { populationPerM2: 0, jobsPerM2: 0.06 },
  industry: { populationPerM2: 0, jobsPerM2: 0.03 },
};

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function parcelToDensityNode(parcel: Parcel): DensityNode | null {
  if (!parcel.suggestedZoneType) return null;
  const density = ZONE_DENSITY[parcel.suggestedZoneType];
  if (!density) return null; // park/none don't contribute population or jobs
  const area = polygonArea(parcel.polygon);
  return {
    id: parcel.id,
    point: polygonCentroid(parcel.polygon),
    projectedPopulation: area * density.populationPerM2,
    projectedJobs: area * density.jobsPerM2,
  };
}

function recomputeDemand(city: CityState): void {
  let population = 0;
  let jobs = 0;
  for (const parcel of city.parcels) {
    const node = parcelToDensityNode(parcel);
    if (node) {
      population += node.projectedPopulation;
      jobs += node.projectedJobs;
    }
  }
  city.demand = { population, jobs };
}

// Cells are a derived/rasterized view (62500 per tile!) — recompute them from
// tiles+parcels+roadGraph rather than persisting them, or the JSONB blob balloons to the
// point that saving it to Supabase hangs (this is exactly what happened: 4 tiles ->
// 250,000 cell objects in one row -> the INSERT/UPDATE never completed within any
// reasonable timeout).
export function rehydrateCells(city: CityState): void {
  const transitStopPoints = city.transitLines.flatMap((line) => line.stops.map((s) => s.point));
  const cells: Cell[] = [];
  for (const tile of city.tiles) {
    const boundary = tileBoundaryFor(tile.gridX, tile.gridY);
    const tileParcels = city.parcels.filter((p) => p.tileId === tile.id);
    cells.push(...rasterizeTileToGrid(tile.id, boundary, tileParcels, city.roadGraph, transitStopPoints));
  }
  city.cells = cells;
}

export interface UnlockResult {
  tile: Tile;
  roadGraph: RoadGraph; // only the segments added by this unlock
  parcels: Parcel[]; // only the parcels added by this unlock
  cells: Cell[]; // only this tile's rasterized grid
  transitLines: TransitLine[]; // full city-wide list (lines can span multiple tiles)
}

export function unlockTile(city: CityState, cityId: string, gridX: number, gridY: number, style: StyleConfig): UnlockResult {
  const boundary = tileBoundaryFor(gridX, gridY);
  const cbdCenter = { x: (GRID_SIZE * TILE_SIZE) / 2, y: (GRID_SIZE * TILE_SIZE) / 2 };

  const seeds = findSeedPoints(city.roadGraph, boundary);
  const fallbackSeed = { x: boundary[0].x + TILE_SIZE / 2, y: boundary[0].y + TILE_SIZE / 2 };
  const newRoads = generateRoads(seeds.length > 0 ? seeds : [fallbackSeed], boundary, [], style);

  city.roadGraph = {
    nodes: [...city.roadGraph.nodes, ...newRoads.nodes],
    edges: [...city.roadGraph.edges, ...newRoads.edges],
  };

  const tile: Tile = {
    id: `${cityId}-${gridX}-${gridY}`,
    cityId,
    gridX,
    gridY,
    status: 'unlocked',
    unlockMilestone: 0,
  };
  city.tiles.push(tile);

  const parcels = subdivideIntoParcels(newRoads, boundary, tile.id, {
    cbdCenter,
    cbdRadius: TILE_SIZE * 0.75,
    transitionRadius: TILE_SIZE * 2.5,
    blockSizeCBD: style.road.blockSizeCBD,
    blockSizeSuburb: style.road.blockSizeSuburb,
    maxSplitDepth: 8,
  });

  // Scored against demand/transit stops as they stood *before* this tile's own parcels
  // exist — this tile's zoning reacts to the city so far, not to itself.
  const existingTransitStops = city.transitLines.flatMap((line) => line.stops);
  for (const parcel of parcels) {
    const best = bestZoneType(parcel, {
      roadGraph: city.roadGraph,
      transitStops: existingTransitStops,
      neighborParcels: city.parcels,
      demand: city.demand,
      style,
    });
    parcel.suggestedZoneType = best.zoneType;
    parcel.score = best.score;
  }
  city.parcels.push(...parcels);
  recomputeDemand(city);

  const densityMap = city.parcels.map(parcelToDensityNode).filter((n): n is DensityNode => n !== null);
  city.transitLines = generateTransitNetwork(city.roadGraph, densityMap, style, city.transitLines);

  const newTransitStopPoints = city.transitLines.flatMap((line) => line.stops.map((s) => s.point));
  const cells = rasterizeTileToGrid(tile.id, boundary, parcels, city.roadGraph, newTransitStopPoints);
  city.cells.push(...cells);

  return { tile, roadGraph: newRoads, parcels, cells, transitLines: city.transitLines };
}
