import { create } from 'zustand';
import type { Cell, RoadGraph, Tile } from '../types/grid';

interface CityState {
  tiles: Tile[];
  cells: Map<string, Cell>;
  roadGraph: RoadGraph;
  selectedCellIds: string[];

  setTiles: (tiles: Tile[]) => void;
  upsertCells: (cells: Cell[]) => void;
  setRoadGraph: (graph: RoadGraph) => void;
  setSelectedCells: (ids: string[]) => void;
  updateCellZone: (ids: string[], zoneType: Cell['zoneType']) => void;
}

export const useCityStore = create<CityState>((set) => ({
  tiles: [],
  cells: new Map(),
  roadGraph: { nodes: [], edges: [] },
  selectedCellIds: [],

  setTiles: (tiles) => set({ tiles }),

  upsertCells: (cells) =>
    set((state) => {
      const next = new Map(state.cells);
      for (const cell of cells) next.set(cell.id, cell);
      return { cells: next };
    }),

  setRoadGraph: (roadGraph) => set({ roadGraph }),

  setSelectedCells: (ids) => set({ selectedCellIds: ids }),

  updateCellZone: (ids, zoneType) =>
    set((state) => {
      const next = new Map(state.cells);
      for (const id of ids) {
        const cell = next.get(id);
        if (cell) next.set(id, { ...cell, zoneType, isRecommended: false });
      }
      return { cells: next };
    }),
}));
