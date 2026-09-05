import { Router } from 'express';
import type { Tile } from '../types/grid.js';

export const tilesRouter = Router();

// In-memory placeholder store — swap for real DB (schema in src/db/schema.sql) once persistence is wired up.
const tiles: Tile[] = [];

tilesRouter.get('/:cityId', (req, res) => {
  const cityTiles = tiles.filter((t) => t.cityId === req.params.cityId);
  res.json(cityTiles);
});

tilesRouter.post('/:cityId/unlock', (req, res) => {
  const { gridX, gridY } = req.body as { gridX: number; gridY: number };
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
