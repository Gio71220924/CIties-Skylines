import type { Parcel, RoadGraph, StyleConfig, ZoneType } from '../../types/grid.js';

export function scoreParcel(
  parcel: Parcel,
  zoneType: ZoneType,
  roadGraph: RoadGraph,
  style: StyleConfig
): number {
  // TODO: score = w1*roadAccess + w2*transitAccess + w3*proximityToSimilarZone
  //             + w4*demandRatio - w5*incompatibilityPenalty
  // Weights come from style.zoningWeights (car-centric vs transit-oriented presets).
  void parcel;
  void zoneType;
  void roadGraph;
  void style;
  return 0;
}

export function scoreAllZoneTypes(
  parcel: Parcel,
  roadGraph: RoadGraph,
  style: StyleConfig
): Record<ZoneType, number> {
  const zoneTypes: ZoneType[] = [
    'resi_low',
    'resi_high',
    'comm_low',
    'comm_high',
    'office',
    'industry',
    'park',
  ];
  return Object.fromEntries(
    zoneTypes.map((zt) => [zt, scoreParcel(parcel, zt, roadGraph, style)])
  ) as Record<ZoneType, number>;
}
