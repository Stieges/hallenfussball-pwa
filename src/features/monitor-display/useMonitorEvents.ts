/**
 * Live-Ereignisse des Monitors (B-16b2). Einzige Stelle des Monitors mit useLiveMatches.
 * Anon-Realtime nur bei Cloud-Herkunft (L2).
 */
import { useLiveMatches } from '../../hooks/useLiveMatches';
import type { DisplayOrigin } from './monitorDataSource';

/**
 * Bei ausgeblendeten Ergebnissen (`ergebnisseAusgeblendet`, @ZM-118) gibt es keine Tor- oder
 * Karten-Einblendung; die Ereignisse werden trotzdem empfangen und verworfen.
 */
export function useMonitorEvents(
  tournamentId: string,
  origin: DisplayOrigin | null,
  ergebnisseAusgeblendet = false,
) {
  const {
    lastGoalEvent,
    clearLastGoalEvent,
    lastCardEvent,
    clearLastCardEvent,
  } = useLiveMatches(tournamentId, { allowPublicRealtime: origin === 'cloud' });

  if (ergebnisseAusgeblendet) {
    return { lastGoalEvent: null, clearLastGoalEvent, lastCardEvent: null, clearLastCardEvent };
  }
  return { lastGoalEvent, clearLastGoalEvent, lastCardEvent, clearLastCardEvent };
}
