// Core domain types — shared shape between backend and frontend (duplicated for now,
// promote to a shared package later if drift becomes painful).

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

// CS1: fixed 5x5 grid = 25 tiles total, each 2km x 2km.
export interface Tile {
  id: string;
  cityId: string;
  gridX: number; // 0-4
  gridY: number; // 0-4
  status: TileStatus;
  unlockMilestone: number; // population threshold
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
  connections: string[]; // edge ids
  isStub: boolean; // dangling end waiting on a not-yet-unlocked neighbor tile
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

export interface Parcel {
  id: string;
  tileId: string;
  polygon: Point[];
  suggestedZoneType: ZoneType | null;
  score: number;
}

export type TransitMode = 'bus' | 'metro' | 'tram';

export interface TransitStop {
  id: string;
  point: Point;
  nearestNodeId: string;
  lineIds: string[];
}

export interface TransitLine {
  id: string;
  mode: TransitMode;
  roadPath: RoadSegment[];
  stops: TransitStop[];
  demandScore: number;
}

export type PlanningStyle = 'car_centric' | 'transit_oriented' | 'balanced' | 'custom';

export interface StyleConfig {
  road: {
    arterialSpacing: number;
    blockSizeCBD: number;
    blockSizeSuburb: number;
    parkingLotAllocation: number;
  };
  transit: {
    stopSpacing: number;
    priorityCorridor: boolean;
    metroLineBoost: number;
    corridorCount: number;
    overlapThreshold: number;
  };
  zoningWeights: {
    roadAccessWeight: number;
    transitAccessWeight: number;
    densityNearTransitBonus: number;
  };
}
