import type { Parcel, Point, RoadGraph, StyleConfig, Tile } from '../types/grid.js';
import { generateRoads } from './roadGenerator/agentGrowth.js';
import { subdivideIntoParcels } from './roadGenerator/blockSubdivider.js';
import { bestZoneType } from './zoningScorer/scoreParcel.js';

export const GRID_SIZE = 5; // CS1: fixed 5x5 tile grid
export const TILE_SIZE = 2000; // meters, CS1 tile is 2km x 2km

export interface CityState {
  tiles: Tile[];
  roadGraph: RoadGraph;
  parcels: Parcel[];
  demand: { population: number; jobs: number };
}

export function createCityState(): CityState {
  return { tiles: [], roadGraph: { nodes: [], edges: [] }, parcels: [], demand: { population: 0, jobs: 0 } };
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

export interface UnlockResult {
  tile: Tile;
  roadGraph: RoadGraph; // only the segments added by this unlock
  parcels: Parcel[]; // only the parcels added by this unlock
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

  for (const parcel of parcels) {
    const best = bestZoneType(parcel, {
      roadGraph: city.roadGraph,
      transitStops: [],
      neighborParcels: city.parcels,
      demand: city.demand,
      style,
    });
    parcel.suggestedZoneType = best.zoneType;
    parcel.score = best.score;
  }
  city.parcels.push(...parcels);

  return { tile, roadGraph: newRoads, parcels };
}
