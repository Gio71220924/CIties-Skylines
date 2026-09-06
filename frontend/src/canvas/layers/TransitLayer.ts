import { Graphics } from 'pixi.js';
import type { TransitLine } from '../../types/grid';

const LINE_COLOR = 0x42a5f5;
const STOP_FILL = 0xffffff;
const STOP_STROKE = 0x1565c0;
const STOP_RADIUS = 5;

export function renderTransitLayer(graphics: Graphics, lines: TransitLine[]): void {
  graphics.clear();

  for (const line of lines) {
    const points = line.roadPath.flatMap((edge) => edge.polyline);
    if (points.length >= 2) {
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) graphics.lineTo(points[i].x, points[i].y);
      graphics.stroke({ width: 4, color: LINE_COLOR, alpha: 0.85, cap: 'round', join: 'round' });
    }

    for (const stop of line.stops) {
      graphics.circle(stop.point.x, stop.point.y, STOP_RADIUS).fill(STOP_FILL).stroke({ width: 2, color: STOP_STROKE });
    }
  }
}
