import type { Cell, Parcel, PlanningStyle, RoadGraph, Tile, TransitLine } from '../types/grid';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export interface UnlockTileResult {
  tile: Tile;
  roadGraph: RoadGraph;
  parcels: Parcel[];
  cells: Cell[];
  transitLines: TransitLine[];
}

export interface CityStateResponse {
  tiles: Tile[];
  roadGraph: RoadGraph;
  parcels: Parcel[];
  cells: Cell[];
  transitLines: TransitLine[];
  demand: { population: number; jobs: number };
}

// requireApiKey on the backend is a stopgap for trusted/service callers, not for a public
// browser client — any VITE_* env var gets inlined into the built JS bundle, so shipping
// the key here would leak it to every visitor. The frontend needs real session/cookie auth
// (credentials: 'include' + a backend session check) before it can call protected mutations;
// until that lands, mutating requests from this client will 401 against a deployed backend.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCityState(cityId: string): Promise<CityStateResponse> {
  return request<CityStateResponse>(`/api/tiles/${cityId}`);
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
