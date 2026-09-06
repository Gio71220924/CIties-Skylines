import { Router } from 'express';
import { requireApiKey } from '../middleware/apiKey.js';
import { resolveStyle } from '../config/styles.js';
import { GRID_SIZE, unlockTile } from '../services/cityService.js';
import { loadCityState, saveCityState } from '../db/cityRepository.js';

export const tilesRouter = Router();

tilesRouter.get('/:cityId', async (req, res) => {
  try {
    const city = await loadCityState(req.params.cityId);
    res.json(city.tiles);
  } catch (err) {
    console.error('GET /api/tiles/:cityId failed:', err);
    res.status(500).json({ error: 'failed to load city state' });
  }
});

tilesRouter.post('/:cityId/unlock', requireApiKey, async (req, res) => {
  const { gridX, gridY, style: styleName } = req.body as { gridX?: unknown; gridY?: unknown; style?: unknown };

  const isValidCoord = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < GRID_SIZE;

  if (!isValidCoord(gridX) || !isValidCoord(gridY)) {
    res.status(400).json({ error: `gridX and gridY must be integers between 0 and ${GRID_SIZE - 1}` });
    return;
  }

  try {
    const city = await loadCityState(req.params.cityId);

    if (city.tiles.some((t) => t.gridX === gridX && t.gridY === gridY)) {
      res.status(409).json({ error: 'tile already unlocked' });
      return;
    }

    const style = resolveStyle(typeof styleName === 'string' ? styleName : undefined);
    const result = unlockTile(city, req.params.cityId, gridX, gridY, style);

    await saveCityState(req.params.cityId, city);

    res.status(201).json(result);
  } catch (err) {
    console.error('POST /api/tiles/:cityId/unlock failed:', err);
    res.status(500).json({ error: 'failed to unlock tile' });
  }
});
