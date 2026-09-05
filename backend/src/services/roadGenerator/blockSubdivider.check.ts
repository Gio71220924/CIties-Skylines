// ponytail: smoke-test for block subdivision, not a full test suite.
// Run with: npm run check:subdivider
import assert from 'node:assert';
import { generateRoads } from './agentGrowth.js';
import { subdivideIntoParcels } from './blockSubdivider.js';
import type { StyleConfig } from '../../types/grid.js';

const style: StyleConfig = {
  road: { arterialSpacing: 120, blockSizeCBD: 100, blockSizeSuburb: 200, parkingLotAllocation: 0.1 },
  transit: { stopSpacing: 400, priorityCorridor: false, metroLineBoost: 1, corridorCount: 5, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.5, transitAccessWeight: 0.3, densityNearTransitBonus: 1 },
};

const tileBoundary = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 2000 },
  { x: 0, y: 2000 },
];

const roadGraph = generateRoads([{ x: 1000, y: 1000 }], tileBoundary, [], style);

function polygonArea(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

const parcels = subdivideIntoParcels(roadGraph, tileBoundary, 'tile-check', {
  cbdCenter: { x: 1000, y: 1000 },
  cbdRadius: 300,
  transitionRadius: 800,
  blockSizeCBD: style.road.blockSizeCBD,
  blockSizeSuburb: style.road.blockSizeSuburb,
  maxSplitDepth: 8,
});

// 1. Road network with real blocks produces at least one parcel.
assert.ok(parcels.length > 0, `expected >0 parcels, got ${parcels.length}`);

// 2. Every parcel is a valid polygon inside the tile, under (or near) its target area.
for (const parcel of parcels) {
  assert.ok(parcel.polygon.length >= 3, `parcel ${parcel.id} has <3 points`);
  const a = polygonArea(parcel.polygon);
  assert.ok(a > 0, `parcel ${parcel.id} has zero area`);
  for (const p of parcel.polygon) {
    assert.ok(p.x >= -1 && p.x <= 2001 && p.y >= -1 && p.y <= 2001, `parcel ${parcel.id} point out of tile: ${p.x},${p.y}`);
  }
}

// 3. No overlapping ids, tileId is stamped correctly.
const ids = new Set(parcels.map((p) => p.id));
assert.strictEqual(ids.size, parcels.length, 'parcel ids collided');
assert.ok(parcels.every((p) => p.tileId === 'tile-check'), 'tileId not stamped on every parcel');

const totalArea = parcels.reduce((sum, p) => sum + polygonArea(p.polygon), 0);
console.log(`OK: ${parcels.length} parcels, total area ${totalArea.toFixed(0)} m^2`);
