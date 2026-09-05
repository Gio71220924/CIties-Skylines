import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey.js';
import { resolveStyle } from '../config/styles.js';
import { GRID_SIZE, createCityState, unlockTile, type CityState } from '../services/cityService.js';

export const tilesRouter = Router();

// In-memory placeholder store — swap for real DB (schema in src/db/schema.sql) once persistence is wired up.
const cities = new Map<string, CityState>();

function getOrCreateCity(cityId: string): CityState {
  let city = cities.get(cityId);
  if (!city) {
    city = createCityState();
    cities.set(cityId, city);
  }
  return city;
}

tilesRouter.get('/:cityId', (req, res) => {
  const city = getOrCreateCity(req.params.cityId);
  res.json(city.tiles);
});

tilesRouter.post('/:cityId/unlock', requireApiKey, (req, res) => {
  const { gridX, gridY, style: styleName } = req.body as { gridX?: unknown; gridY?: unknown; style?: unknown };

  const isValidCoord = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < GRID_SIZE;

  if (!isValidCoord(gridX) || !isValidCoord(gridY)) {
    res.status(400).json({ error: `gridX and gridY must be integers between 0 and ${GRID_SIZE - 1}` });
    return;
  }

  const city = getOrCreateCity(req.params.cityId);

  if (city.tiles.some((t) => t.gridX === gridX && t.gridY === gridY)) {
    res.status(409).json({ error: 'tile already unlocked' });
    return;
  }

  const style = resolveStyle(typeof styleName === 'string' ? styleName : undefined);
  const result = unlockTile(city, req.params.cityId, gridX, gridY, style);

  res.status(201).json(result);
});
