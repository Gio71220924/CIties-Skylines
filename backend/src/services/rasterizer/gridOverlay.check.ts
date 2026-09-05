// ponytail: smoke-test for the grid rasterizer, not a full test suite.
// Run with: npm run check:rasterizer
// Uses a small synthetic 80x80m boundary (10x10 cells at 8m) instead of a full 2000m tile
// (which would be 250x250 = 62500 cells) so this stays fast and easy to reason about.
import assert from 'node:assert';
import { rasterizeTileToGrid } from './gridOverlay.js';
import type { Parcel, RoadGraph } from '../../types/grid.js';

const boundary = [
  { x: 0, y: 0 },
  { x: 80, y: 0 },
  { x: 80, y: 80 },
  { x: 0, y: 80 },
];

// One parcel covering the left half, zoned resi_low; right half has no parcel (stays 'none').
const parcels: Parcel[] = [
  {
    id: 'p1',
    tileId: 'tile-check',
    polygon: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 80 },
      { x: 0, y: 80 },
    ],
    suggestedZoneType: 'resi_low',
    score: 0.7,
  },
];

// One road running vertically at x=40 (the parcel/empty-space boundary).
const roadGraph: RoadGraph = {
  nodes: [
    { id: 'n1', point: { x: 40, y: 0 }, connections: ['e1'], isStub: false, facingTileCoord: null },
    { id: 'n2', point: { x: 40, y: 80 }, connections: ['e1'], isStub: false, facingTileCoord: null },
  ],
  edges: [
    { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', type: 'local', polyline: [{ x: 40, y: 0 }, { x: 40, y: 80 }], depth: 0 },
  ],
};

const transitStops = [{ x: 20, y: 40 }];

const cells = rasterizeTileToGrid('tile-check', boundary, parcels, roadGraph, transitStops);

// 1. Grid dimensions: 80m / 8m = 10x10 = 100 cells.
assert.strictEqual(cells.length, 100, `expected 100 cells, got ${cells.length}`);

// 2. Cells on the left half (inside the parcel) are zoned resi_low; right half stays 'none'.
const leftCells = cells.filter((c) => c.localX < 5);
const rightCells = cells.filter((c) => c.localX >= 5);
assert.ok(leftCells.every((c) => c.zoneType === 'resi_low'), 'all left-half cells should be resi_low');
assert.ok(rightCells.every((c) => c.zoneType === 'none'), 'all right-half cells should be unzoned');
assert.ok(leftCells.every((c) => c.isRecommended), 'zoned cells should be marked recommended');
assert.ok(rightCells.every((c) => !c.isRecommended), 'unzoned cells should not be marked recommended');

// 3. Cells right next to the road (x=40, i.e. localX 4 or 5) are road-adjacent; far cells are not.
const nearRoad = cells.filter((c) => c.localX === 4 || c.localX === 5);
const farFromRoad = cells.filter((c) => c.localX === 0 || c.localX === 9);
assert.ok(nearRoad.every((c) => c.roadAdjacent), 'cells adjacent to the road column should be roadAdjacent');
assert.ok(farFromRoad.every((c) => !c.roadAdjacent), 'cells far from the road should not be roadAdjacent');

// 4. Transit stop at (20,40) is within the 500m catchment of every cell in this tiny tile.
assert.ok(cells.every((c) => c.transitAdjacent), 'every cell should be within the transit catchment in this small tile');

// 5. Every cell has a unique id and correct tileId.
const ids = new Set(cells.map((c) => c.id));
assert.strictEqual(ids.size, cells.length, 'cell ids collided');
assert.ok(cells.every((c) => c.tileId === 'tile-check'), 'tileId not stamped on every cell');

console.log(`OK: ${cells.length} cells, ${leftCells.length} zoned, ${nearRoad.length} road-adjacent`);
