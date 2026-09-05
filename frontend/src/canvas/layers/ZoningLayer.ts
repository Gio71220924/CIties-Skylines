import { Graphics } from 'pixi.js';
import type { Parcel, ZoneType } from '../../types/grid';

const ZONE_COLORS: Record<Exclude<ZoneType, 'none'>, number> = {
  resi_low: 0x8bc34a,
  resi_high: 0x4caf50,
  comm_low: 0x64b5f6,
  comm_high: 0x1976d2,
  office: 0x9575cd,
  industry: 0xffb74d,
  park: 0x2e7d32,
};

const ZONE_ALPHA = 0.55;

export function renderZoningLayer(graphics: Graphics, parcels: Iterable<Parcel>): void {
  graphics.clear();
  for (const parcel of parcels) {
    const zoneType = parcel.suggestedZoneType;
    if (!zoneType || zoneType === 'none' || parcel.polygon.length < 3) continue;

    graphics
      .poly(parcel.polygon.flatMap((p) => [p.x, p.y]))
      .fill({ color: ZONE_COLORS[zoneType], alpha: ZONE_ALPHA });
  }
}
