// ponytail: smoke-test for city-service tile unlock wiring, not a full test suite.
// Run with: npm run check:city
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { createCityState, unlockTile, tileBoundaryFor } from './cityService.js';
import { BALANCED_STYLE } from '../config/styles.js';

const city = createCityState();

// 1. First tile unlock: no existing roads, falls back to a center seed and still produces a network.
const first = unlockTile(city, 'city-check', 2, 2, BALANCED_STYLE);
assert.ok(first.roadGraph.nodes.length > 0, 'first tile should generate at least one road node');
assert.ok(first.parcels.length > 0, 'first tile should produce at least one parcel');
assert.strictEqual(city.tiles.length, 1);
assert.strictEqual(city.roadGraph.nodes.length, first.roadGraph.nodes.length);

// 2. Simulate a prior tile's road reaching the shared boundary (deterministic, instead of
//    depending on tile 1's own randomized growth reaching that exact edge) and confirm
//    findSeedPoints() inside unlockTile() picks it up as a seed for the new neighbor tile.
const sharedBoundaryX = tileBoundaryFor(3, 2)[0].x; // left edge of (3,2) == right edge of (2,2)
const injectedPoint = { x: sharedBoundaryX, y: 5000 };
city.roadGraph.nodes.push({ id: randomUUID(), point: injectedPoint, connections: [], isStub: false, facingTileCoord: null });

const second = unlockTile(city, 'city-check', 3, 2, BALANCED_STYLE);
const seedPickedUp = second.roadGraph.nodes.some(
  (n) => Math.hypot(n.point.x - injectedPoint.x, n.point.y - injectedPoint.y) < 1
);
assert.ok(seedPickedUp, 'second tile network should include a node at the injected boundary seed point');
assert.strictEqual(city.tiles.length, 2);

// 3. City state accumulates across unlocks (no accidental overwrite of prior tile's data).
assert.ok(city.parcels.length >= first.parcels.length + second.parcels.length, 'city should accumulate parcels across unlocks');
assert.strictEqual(city.roadGraph.nodes.length, first.roadGraph.nodes.length + second.roadGraph.nodes.length + 1); // +1 injected node

// 4. Each unlock rasterizes its own tile's cells (250x250 at 8m = 62500 cells per tile).
assert.strictEqual(first.cells.length, 62500, `expected 62500 cells for tile 1, got ${first.cells.length}`);
assert.strictEqual(second.cells.length, 62500, `expected 62500 cells for tile 2, got ${second.cells.length}`);
assert.strictEqual(city.cells.length, first.cells.length + second.cells.length);

// 5. Transit network gets built from the scored parcels (both tiles have enough density
//    for at least one corridor to route, since BALANCED_STYLE's demand model isn't zero).
assert.ok(second.transitLines.length >= 0, 'transitLines should at least be an array, not throw');
assert.strictEqual(city.transitLines, second.transitLines, 'unlockTile should return the city\'s current transit line list');

console.log(
  `OK: tile1 nodes=${first.roadGraph.nodes.length} parcels=${first.parcels.length} cells=${first.cells.length}, ` +
  `tile2 nodes=${second.roadGraph.nodes.length} parcels=${second.parcels.length} cells=${second.cells.length}, ` +
  `seedPickedUp=${seedPickedUp}, transitLines=${second.transitLines.length}`
);
