import type { Point, RoadGraph, RoadNode, RoadSegment, StyleConfig } from '../../types/grid.js';

interface GrowthParams {
  arterialLength: number;
  localLength: number;
  branchIntervalArterial: number;
  branchAngleRange: [number, number];
  angleJitter: number;
  snapRadius: number;
  maxDepth: number;
}

const DEFAULT_PARAMS: GrowthParams = {
  arterialLength: 120,
  localLength: 40,
  branchIntervalArterial: 3,
  branchAngleRange: [70, 110],
  angleJitter: 15,
  snapRadius: 15,
  maxDepth: 6,
};

export function generateRoads(
  seedPoints: Point[],
  tileBoundary: Point[],
  terrainMask: Point[][],
  style: StyleConfig,
  params: GrowthParams = DEFAULT_PARAMS
): RoadGraph {
  // TODO: priority-queue driven growth per the agentGrowth design —
  // propose segment -> legalize (bounds/terrain/snap/intersection) -> commit -> propose next.
  // See project notes for full algorithm (proposeNext branching rules, legalize constraints).
  void seedPoints;
  void tileBoundary;
  void terrainMask;
  void style;
  void params;
  const nodes: RoadNode[] = [];
  const edges: RoadSegment[] = [];
  return { nodes, edges };
}
