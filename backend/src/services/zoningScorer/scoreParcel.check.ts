// ponytail: smoke-test for the zoning scorer, not a full test suite.
// Run with: npm run check:scorer
import assert from 'node:assert';
import { scoreParcel, bestZoneType } from './scoreParcel.js';
import type { Parcel, RoadGraph, StyleConfig, ZoneType } from '../../types/grid.js';

const style: StyleConfig = {
  road: { arterialSpacing: 120, blockSizeCBD: 100, blockSizeSuburb: 200, parkingLotAllocation: 0.1 },
  transit: { stopSpacing: 400, priorityCorridor: false, metroLineBoost: 1, corridorCount: 5, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.5, transitAccessWeight: 0.3, densityNearTransitBonus: 1.5 },
};

const arterialRoad: RoadGraph = {
  nodes: [
    { id: 'n1', point: { x: 0, y: 500 }, connections: ['e1'], isStub: false, facingTileCoord: null },
    { id: 'n2', point: { x: 2000, y: 500 }, connections: ['e1'], isStub: false, facingTileCoord: null },
  ],
  edges: [
    {
      id: 'e1',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      type: 'arterial',
      polyline: [{ x: 0, y: 500 }, { x: 2000, y: 500 }],
      depth: 0,
    },
  ],
};

function makeParcel(id: string, center: { x: number; y: number }, zoneType: ZoneType | null = null): Parcel {
  const half = 20;
  return {
    id,
    tileId: 'tile-check',
    polygon: [
      { x: center.x - half, y: center.y - half },
      { x: center.x + half, y: center.y - half },
      { x: center.x + half, y: center.y + half },
      { x: center.x - half, y: center.y + half },
    ],
    suggestedZoneType: zoneType,
    score: 0,
  };
}

const nearArterial = makeParcel('p1', { x: 1000, y: 510 });
const farFromArterial = makeParcel('p2', { x: 1000, y: 1900 });
const balancedDemand = { population: 1000, jobs: 500 };

// 1. Industry scores higher near arterial than far from it (arterial-specific access preference).
const industryNear = scoreParcel(nearArterial, 'industry', {
  roadGraph: arterialRoad, transitStops: [], neighborParcels: [], demand: balancedDemand, style,
});
const industryFar = scoreParcel(farFromArterial, 'industry', {
  roadGraph: arterialRoad, transitStops: [], neighborParcels: [], demand: balancedDemand, style,
});
assert.ok(industryNear > industryFar, `industry near arterial (${industryNear}) should beat far (${industryFar})`);

// 2. Incompatibility: industry surrounded by residential scores lower than isolated industry.
const resiNeighbors: Parcel[] = [
  makeParcel('r1', { x: 990, y: 500 }, 'resi_low'),
  makeParcel('r2', { x: 1010, y: 500 }, 'resi_low'),
  makeParcel('r3', { x: 1000, y: 490 }, 'resi_low'),
];
const industryWithResi = scoreParcel(nearArterial, 'industry', {
  roadGraph: arterialRoad, transitStops: [], neighborParcels: resiNeighbors, demand: balancedDemand, style,
});
assert.ok(industryWithResi < industryNear, `industry near resi (${industryWithResi}) should score lower than isolated (${industryNear})`);

// 3. Jobs deficit (population >> jobs) should push bestZoneType toward a job-producing zone.
const jobsDeficit = { population: 5000, jobs: 0 };
const bestUnderJobsDeficit = bestZoneType(nearArterial, {
  roadGraph: arterialRoad, transitStops: [], neighborParcels: [], demand: jobsDeficit, style,
});
assert.ok(
  ['comm_low', 'comm_high', 'office', 'industry'].includes(bestUnderJobsDeficit.zoneType),
  `expected a job-producing zone under jobs deficit, got ${bestUnderJobsDeficit.zoneType}`
);

// 4. Housing deficit (jobs >> population) should push bestZoneType toward residential.
const housingDeficit = { population: 100, jobs: 5000 };
const bestUnderHousingDeficit = bestZoneType(nearArterial, {
  roadGraph: arterialRoad, transitStops: [], neighborParcels: [], demand: housingDeficit, style,
});
assert.ok(
  ['resi_low', 'resi_high'].includes(bestUnderHousingDeficit.zoneType),
  `expected a residential zone under housing deficit, got ${bestUnderHousingDeficit.zoneType}`
);

console.log(
  `OK: industryNear=${industryNear.toFixed(2)} industryFar=${industryFar.toFixed(2)} ` +
  `industryWithResi=${industryWithResi.toFixed(2)} jobsDeficit->${bestUnderJobsDeficit.zoneType} ` +
  `housingDeficit->${bestUnderHousingDeficit.zoneType}`
);
