/**
 * Live-Ereignisse des Monitors (B-16b2). Einzige Stelle des Monitors mit useLiveMatches.
 * Anon-Realtime nur bei Cloud-Herkunft (L2).
 */
import { useLiveMatches } from '../../hooks/useLiveMatches';
import type { DisplayOrigin } from './monitorDataSource';

export function useMonitorEvents(tournamentId: string, origin: DisplayOrigin | null) {
  const {
    lastGoalEvent,
    clearLastGoalEvent,
    lastCardEvent,
    clearLastCardEvent,
  } = useLiveMatches(tournamentId, { allowPublicRealtime: origin === 'cloud' });

  return { lastGoalEvent, clearLastGoalEvent, lastCardEvent, clearLastCardEvent };
}
