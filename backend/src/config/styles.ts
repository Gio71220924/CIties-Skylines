import type { PlanningStyle, StyleConfig } from '../types/grid.js';

// Presets from the car-centric <-> transit-oriented design discussion.
// zoningWeights/road/transit values are the tunable knobs; proximity/demand/
// incompatibility weights inside scoreParcel.ts stay fixed across all presets.

export const CAR_CENTRIC_STYLE: StyleConfig = {
  road: { arterialSpacing: 300, blockSizeCBD: 150, blockSizeSuburb: 400, parkingLotAllocation: 0.15 },
  transit: { stopSpacing: 800, priorityCorridor: false, metroLineBoost: 1.0, corridorCount: 6, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.6, transitAccessWeight: 0.2, densityNearTransitBonus: 1.0 },
};

export const TRANSIT_ORIENTED_STYLE: StyleConfig = {
  road: { arterialSpacing: 500, blockSizeCBD: 80, blockSizeSuburb: 200, parkingLotAllocation: 0.02 },
  transit: { stopSpacing: 400, priorityCorridor: true, metroLineBoost: 2.5, corridorCount: 6, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.25, transitAccessWeight: 0.55, densityNearTransitBonus: 2.0 },
};

export const BALANCED_STYLE: StyleConfig = {
  road: { arterialSpacing: 200, blockSizeCBD: 100, blockSizeSuburb: 250, parkingLotAllocation: 0.08 },
  transit: { stopSpacing: 500, priorityCorridor: false, metroLineBoost: 1.5, corridorCount: 6, overlapThreshold: 0.5 },
  zoningWeights: { roadAccessWeight: 0.45, transitAccessWeight: 0.35, densityNearTransitBonus: 1.3 },
};

export function resolveStyle(name: PlanningStyle | string | undefined): StyleConfig {
  switch (name) {
    case 'car_centric':
      return CAR_CENTRIC_STYLE;
    case 'transit_oriented':
      return TRANSIT_ORIENTED_STYLE;
    default:
      return BALANCED_STYLE;
  }
}
