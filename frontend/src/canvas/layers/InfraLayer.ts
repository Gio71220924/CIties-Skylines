import { Graphics } from 'pixi.js';
import type { RoadGraph } from '../../types/grid';

const ARTERIAL_COLOR = 0xffcc66;
const LOCAL_COLOR = 0xaaaaaa;

export function renderInfraLayer(graphics: Graphics, roadGraph: RoadGraph): void {
  graphics.clear();
  for (const edge of roadGraph.edges) {
    if (edge.polyline.length < 2) continue;
    const width = edge.type === 'arterial' ? 6 : 3;
    const color = edge.type === 'arterial' ? ARTERIAL_COLOR : LOCAL_COLOR;

    graphics.moveTo(edge.polyline[0].x, edge.polyline[0].y);
    for (let i = 1; i < edge.polyline.length; i++) {
      graphics.lineTo(edge.polyline[i].x, edge.polyline[i].y);
    }
    graphics.stroke({ width, color });
  }
}
