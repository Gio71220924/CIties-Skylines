// Mirrors backend/src/types/grid.ts — duplicated for now, promote to a shared
// package later if the two start drifting.

export interface Point {
  x: number;
  y: number;
}

export type ZoneType =
  | 'resi_low'
  | 'resi_high'
  | 'comm_low'
  | 'comm_high'
  | 'office'
  | 'industry'
  | 'park'
  | 'none';

export type TileStatus = 'locked' | 'unlocked';

export interface Tile {
  id: string;
  cityId: string;
  gridX: number; // 0-4
  gridY: number; // 0-4
  status: TileStatus;
  unlockMilestone: number;
}

export interface Cell {
  id: string;
  tileId: string;
  localX: number;
  localY: number;
  zoneType: ZoneType;
  isRecommended: boolean;
  roadAdjacent: boolean;
  transitAdjacent: boolean;
}

export type RoadType = 'arterial' | 'local';

export interface RoadNode {
  id: string;
  point: Point;
  connections: string[];
  isStub: boolean;
  facingTileCoord: { x: number; y: number } | null;
}

export interface RoadSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: RoadType;
  polyline: Point[];
  depth: number;
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadSegment[];
}

export type PlanningStyle = 'car_centric' | 'transit_oriented' | 'balanced' | 'custom';
