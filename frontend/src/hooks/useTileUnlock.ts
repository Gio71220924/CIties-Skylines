import { useState, useCallback } from 'react';
import { unlockTile } from '../api/tiles';
import { useCityStore } from '../store/cityStore';
import type { PlanningStyle } from '../types/grid';

export function useTileUnlock(cityId: string) {
  const applyUnlockResult = useCityStore((s) => s.applyUnlockResult);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(
    async (gridX: number, gridY: number, style?: PlanningStyle) => {
      setIsUnlocking(true);
      setError(null);
      try {
        const result = await unlockTile(cityId, gridX, gridY, style);
        applyUnlockResult(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'failed to unlock tile');
        return null;
      } finally {
        setIsUnlocking(false);
      }
    },
    [cityId, applyUnlockResult]
  );

  return { unlock, isUnlocking, error };
}
