import { Graphics } from 'pixi.js';
import type { Tile } from '../../types/grid';

const TILE_SIZE = 2000; // meters, CS1 tile
const GRID_SIZE = 5; // CS1: fixed 5x5 tile grid

const LOCKED_COLOR = 0x232323;
const UNLOCKED_COLOR = 0x35402f;
const BORDER_COLOR = 0x4a4a4a;

export function renderTerrainLayer(graphics: Graphics, tiles: Tile[]): void {
  graphics.clear();
  const unlocked = new Set(tiles.map((t) => `${t.gridX},${t.gridY}`));

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const isUnlocked = unlocked.has(`${gx},${gy}`);
      graphics
        .rect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        .fill(isUnlocked ? UNLOCKED_COLOR : LOCKED_COLOR)
        .stroke({ width: 4, color: BORDER_COLOR });
    }
  }
}
