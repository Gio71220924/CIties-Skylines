// ponytail: smoke-test for the road growth algorithm, not a full test suite.
// Run with: npm run check
import assert from 'node:assert';
import { generateRoads } from './agentGrowth.js';
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

// 1. Basic growth from a single seed produces a connected, non-trivial network.
const graph = generateRoads([{ x: 1000, y: 1000 }], tileBoundary, [], style);
assert.ok(graph.nodes.length > 5, `expected >5 nodes, got ${graph.nodes.length}`);
assert.ok(graph.edges.length > 5, `expected >5 edges, got ${graph.edges.length}`);

// 2. Every node stays inside the tile boundary (legalize's bounds check held).
for (const node of graph.nodes) {
  assert.ok(node.point.x >= 0 && node.point.x <= 2000, `node.x out of bounds: ${node.point.x}`);
  assert.ok(node.point.y >= 0 && node.point.y <= 2000, `node.y out of bounds: ${node.point.y}`);
}

// 3. Every edge references nodes that actually exist (commit()/splitEdgeAt() kept the graph consistent).
const nodeIds = new Set(graph.nodes.map((n) => n.id));
for (const edge of graph.edges) {
  assert.ok(nodeIds.has(edge.fromNodeId), `edge references missing fromNode ${edge.fromNodeId}`);
  assert.ok(nodeIds.has(edge.toNodeId), `edge references missing toNode ${edge.toNodeId}`);
}

// 4. A terrain mask covering the whole tile blocks all growth (legalize's terrain check held).
const fullBlock = generateRoads(
  [{ x: 1000, y: 1000 }],
  tileBoundary,
  [[{ x: -10, y: -10 }, { x: 2010, y: -10 }, { x: 2010, y: 2010 }, { x: -10, y: 2010 }]],
  style
);
assert.strictEqual(fullBlock.edges.length, 0, `expected 0 edges with full terrain block, got ${fullBlock.edges.length}`);

// 5. Multiple far-apart seeds (like interiorSeedGrid's 3x3 grid) end up as ONE connected
//    network, not scattered disconnected islands — connectIslands' job.
const multiSeedGraph = generateRoads(
  [
    { x: 300, y: 300 },
    { x: 1700, y: 300 },
    { x: 300, y: 1700 },
    { x: 1700, y: 1700 },
    { x: 1000, y: 1000 },
  ],
  tileBoundary,
  [],
  style
);
function countComponents(nodes: typeof multiSeedGraph.nodes, edges: typeof multiSeedGraph.edges): number {
  const parent = new Map(nodes.map((n) => [n.id, n.id]));
  function find(x: string): string {
    while (parent.get(x) !== x) x = parent.get(x) as string;
    return x;
  }
  for (const e of edges) parent.set(find(e.fromNodeId), find(e.toNodeId));
  return new Set(nodes.map((n) => find(n.id))).size;
}
const componentCount = countComponents(multiSeedGraph.nodes, multiSeedGraph.edges);
assert.strictEqual(componentCount, 1, `expected 1 connected component across 5 far-apart seeds, got ${componentCount}`);

console.log(`OK: ${graph.nodes.length} nodes, ${graph.edges.length} edges, multiSeed components=${componentCount}`);
