import { useCityStore } from '../../store/cityStore';
import { useTileUnlock } from '../../hooks/useTileUnlock';
import { CITY_ID } from '../../constants';

const GRID_SIZE = 5;

export function TileUnlockButton() {
  const tiles = useCityStore((s) => s.tiles);
  const { unlock, isUnlocking, error } = useTileUnlock(CITY_ID);

  const unlockedSet = new Set(tiles.map((t) => `${t.gridX},${t.gridY}`));

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(20,20,20,0.85)',
        padding: 10,
        borderRadius: 6,
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 6 }}>Unlock tile{isUnlocking ? ' — unlocking…' : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 24px)`, gap: 2 }}>
        {Array.from({ length: GRID_SIZE }, (_, gy) =>
          Array.from({ length: GRID_SIZE }, (_, gx) => {
            const isUnlocked = unlockedSet.has(`${gx},${gy}`);
            return (
              <button
                key={`${gx}-${gy}`}
                type="button"
                disabled={isUnlocked || isUnlocking}
                onClick={() => unlock(gx, gy)}
                style={{
                  width: 24,
                  height: 24,
                  background: isUnlocked ? '#4caf50' : '#333',
                  border: '1px solid #555',
                  color: '#eee',
                  cursor: isUnlocked || isUnlocking ? 'default' : 'pointer',
                  fontSize: 9,
                }}
                title={`tile (${gx}, ${gy})`}
              >
                {isUnlocked ? '✓' : ''}
              </button>
            );
          })
        )}
      </div>
      {error && <div style={{ color: '#ff8080', marginTop: 6, maxWidth: 140 }}>{error}</div>}
    </div>
  );
}
