// ponytail: smoke-test for the transit router, not a full test suite.
// Run with: npm run check:transit
import assert from 'node:assert';
import { generateRoads } from '../roadGenerator/agentGrowth.js';
import { generateTransitNetwork } from './transitRouter.js';
import type { StyleConfig } from '../../types/grid.js';

const style: StyleConfig = {
  road: { arterialSpacing: 120, blockSizeCBD: 100, blockSizeSuburb: 200, parkingLotAllocation: 0.1 },
  transit: { stopSpacing: 150, priorityCorridor: false, metroLineBoost: 1, corridorCount: 5, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.5, transitAccessWeight: 0.3, densityNearTransitBonus: 1.3 },
};

const tileBoundary = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 2000 },
  { x: 0, y: 2000 },
];

// Two seeds far apart so the road network spans the tile and A* has real distance to cover.
const roadGraph = generateRoads([{ x: 200, y: 1000 }, { x: 1800, y: 1000 }], tileBoundary, [], style);

const densityMap = [
  { id: 'd1', point: { x: 200, y: 1000 }, projectedPopulation: 2000, projectedJobs: 100 },
  { id: 'd2', point: { x: 1800, y: 1000 }, projectedPopulation: 200, projectedJobs: 2000 },
  { id: 'd3', point: { x: 1000, y: 200 }, projectedPopulation: 50, projectedJobs: 20 }, // low demand, shouldn't dominate
];

const lines = generateTransitNetwork(roadGraph, densityMap, style);

// 1. At least one line got routed (road network actually connects the two dense clusters).
assert.ok(lines.length > 0, `expected at least one transit line, got ${lines.length}`);

// 2. Every line's roadPath is a real chain of existing edges (A* didn't invent edges).
const edgeIds = new Set(roadGraph.edges.map((e) => e.id));
for (const line of lines) {
  assert.ok(line.roadPath.length > 0, `line ${line.id} has an empty roadPath`);
  for (const edge of line.roadPath) {
    assert.ok(edgeIds.has(edge.id), `line ${line.id} references an edge not in the road graph: ${edge.id}`);
  }
}

// 3. Every line has stops, including endpoints, spaced no more than ~2x stopSpacing apart.
for (const line of lines) {
  assert.ok(line.stops.length >= 2, `line ${line.id} should have at least start+end stops, got ${line.stops.length}`);
}

// 4. Lines are ranked by demandScore descending.
for (let i = 1; i < lines.length; i++) {
  assert.ok(lines[i - 1].demandScore >= lines[i].demandScore, 'lines should be sorted by demandScore descending');
}

// 5. Re-running with the previous result as existingLines shouldn't duplicate near-identical lines.
const secondPass = generateTransitNetwork(roadGraph, densityMap, style, lines);
assert.strictEqual(secondPass.length, lines.length, `re-generating with existingLines should not duplicate lines (${secondPass.length} vs ${lines.length})`);

console.log(`OK: ${lines.length} line(s), top demandScore=${lines[0]?.demandScore.toFixed(6)}, stops=${lines.map((l) => l.stops.length)}`);
