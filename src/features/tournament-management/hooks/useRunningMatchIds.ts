/**
 * useRunningMatchIds (A-08f2, @FU-087): Laufende Spiele des Spielplans -- Quelle ist allein
 * `useLiveMatches` (Realtime bzw. Gast-Poll), kein eigener localStorage-Zugriff mehr.
 */
import { useMemo } from 'react';
import { useLiveMatches } from '../../../hooks/useLiveMatches';

export function useRunningMatchIds(tournamentId: string): Set<string> {
  const { liveMatches } = useLiveMatches(tournamentId);
  return useMemo(
    () => new Set(
      Array.from(liveMatches.values())
        .filter(m => m.status === 'RUNNING' || m.status === 'PAUSED')
        .map(m => m.id),
    ),
    [liveMatches],
  );
}
