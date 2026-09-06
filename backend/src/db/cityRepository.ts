import { requireDb } from './client.js';
import { createCityState, type CityState } from '../services/cityService.js';

export async function loadCityState(cityId: string): Promise<CityState> {
  const pool = requireDb();
  const res = await pool.query<{ state: CityState }>('SELECT state FROM city_states WHERE city_id = $1', [cityId]);
  return res.rows[0]?.state ?? createCityState();
}

export async function saveCityState(cityId: string, state: CityState): Promise<void> {
  const pool = requireDb();
  await pool.query(
    `INSERT INTO city_states (city_id, state, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (city_id) DO UPDATE SET state = $2, updated_at = now()`,
    [cityId, JSON.stringify(state)]
  );
}
