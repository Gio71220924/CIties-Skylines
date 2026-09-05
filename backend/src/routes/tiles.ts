import { Router } from 'express';
import type { Tile } from '../types/grid.js';
import { requireApiKey } from '../middleware/apiKey.js';

export const tilesRouter = Router();

// In-memory placeholder store — swap for real DB (schema in src/db/schema.sql) once persistence is wired up.
const tiles: Tile[] = [];

const GRID_SIZE = 5; // CS1: fixed 5x5 tile grid

tilesRouter.get('/:cityId', (req, res) => {
  const cityTiles = tiles.filter((t) => t.cityId === req.params.cityId);
  res.json(cityTiles);
});

tilesRouter.post('/:cityId/unlock', requireApiKey, (req, res) => {
  const { gridX, gridY } = req.body as { gridX?: unknown; gridY?: unknown };

  const isValidCoord = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < GRID_SIZE;

  if (!isValidCoord(gridX) || !isValidCoord(gridY)) {
    res.status(400).json({ error: `gridX and gridY must be integers between 0 and ${GRID_SIZE - 1}` });
    return;
  }

  const tile: Tile = {
    id: `${req.params.cityId}-${gridX}-${gridY}`,
    cityId: req.params.cityId,
    gridX,
    gridY,
    status: 'unlocked',
    unlockMilestone: 0,
  };
  tiles.push(tile);
  // TODO: trigger roadGenerator.generateRoads() + zoningScorer + transitRouter for this tile
  res.status(201).json(tile);
});
