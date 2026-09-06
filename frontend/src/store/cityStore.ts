import { create } from 'zustand';
import type { Cell, Parcel, RoadGraph, Tile, TransitLine } from '../types/grid';
import type { CityStateResponse, UnlockTileResult } from '../api/tiles';

interface CityState {
  tiles: Tile[];
  cells: Map<string, Cell>;
  parcels: Map<string, Parcel>;
  roadGraph: RoadGraph;
  transitLines: TransitLine[];
  selectedCellIds: string[];

  setTiles: (tiles: Tile[]) => void;
  upsertCells: (cells: Cell[]) => void;
  upsertParcels: (parcels: Parcel[]) => void;
  mergeRoadGraph: (delta: RoadGraph) => void;
  setTransitLines: (lines: TransitLine[]) => void;
  setSelectedCells: (ids: string[]) => void;
  updateCellZone: (ids: string[], zoneType: Cell['zoneType']) => void;
  applyUnlockResult: (result: UnlockTileResult) => void;
  hydrate: (snapshot: CityStateResponse) => void;
}

export const useCityStore = create<CityState>((set, get) => ({
  tiles: [],
  cells: new Map(),
  parcels: new Map(),
  roadGraph: { nodes: [], edges: [] },
  transitLines: [],
  selectedCellIds: [],

  setTiles: (tiles) => set({ tiles }),

  upsertCells: (cells) =>
    set((state) => {
      const next = new Map(state.cells);
      for (const cell of cells) next.set(cell.id, cell);
      return { cells: next };
    }),

  upsertParcels: (parcels) =>
    set((state) => {
      const next = new Map(state.parcels);
      for (const parcel of parcels) next.set(parcel.id, parcel);
      return { parcels: next };
    }),

  // The backend only returns the segments/nodes added by one unlock, not the full city
  // graph — merge rather than replace, or every prior tile's roads would disappear.
  mergeRoadGraph: (delta) =>
    set((state) => ({
      roadGraph: {
        nodes: [...state.roadGraph.nodes, ...delta.nodes],
        edges: [...state.roadGraph.edges, ...delta.edges],
      },
    })),

  setTransitLines: (lines) => set({ transitLines: lines }),

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

  applyUnlockResult: (result) => {
    const { setTiles, upsertCells, upsertParcels, mergeRoadGraph, setTransitLines } = get();
    setTiles([...get().tiles, result.tile]);
    upsertCells(result.cells);
    upsertParcels(result.parcels);
    mergeRoadGraph(result.roadGraph);
    setTransitLines(result.transitLines); // already the full city-wide list from the backend
  },

  // Full replace, not merge — this is a complete snapshot from GET /api/tiles/:cityId,
  // called once on mount so a page reload shows whatever the backend already knows about
  // instead of an empty grid that then 409s the moment you click an "already unlocked" tile.
  hydrate: (snapshot) => {
    set({
      tiles: snapshot.tiles,
      cells: new Map(snapshot.cells.map((c) => [c.id, c])),
      parcels: new Map(snapshot.parcels.map((p) => [p.id, p])),
      roadGraph: snapshot.roadGraph,
      transitLines: snapshot.transitLines,
    });
  },
}));
