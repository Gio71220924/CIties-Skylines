import { requireDb } from './client.js';
import { createCityState, rehydrateCells, type CityState } from '../services/cityService.js';

export async function loadCityState(cityId: string): Promise<CityState> {
  const pool = requireDb();
  const res = await pool.query<{ state: CityState }>('SELECT state FROM city_states WHERE city_id = $1', [cityId]);
  const city = res.rows[0]?.state ?? createCityState();
  rehydrateCells(city); // cells aren't persisted (see rehydrateCells) — recompute on every load
  return city;
}

export async function saveCityState(cityId: string, state: CityState): Promise<void> {
  const pool = requireDb();
  // Never persist cells: 62500 rasterized cells per tile blew the JSONB payload up to the
  // point that the write itself hung indefinitely against Supabase's pooler.
  const { cells: _cells, ...persisted } = state;
  await pool.query(
    `INSERT INTO city_states (city_id, state, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (city_id) DO UPDATE SET state = $2, updated_at = now()`,
    [cityId, JSON.stringify(persisted)]
  );
}
