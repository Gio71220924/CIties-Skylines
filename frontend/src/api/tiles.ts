import type { Cell, Parcel, PlanningStyle, RoadGraph, Tile, TransitLine } from '../types/grid';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_API_KEY;

export interface UnlockTileResult {
  tile: Tile;
  roadGraph: RoadGraph;
  parcels: Parcel[];
  cells: Cell[];
  transitLines: TransitLine[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchTiles(cityId: string): Promise<Tile[]> {
  return request<Tile[]>(`/api/tiles/${cityId}`);
}

export function unlockTile(
  cityId: string,
  gridX: number,
  gridY: number,
  style?: PlanningStyle
): Promise<UnlockTileResult> {
  return request<UnlockTileResult>(`/api/tiles/${cityId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ gridX, gridY, style }),
  });
}
