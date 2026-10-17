/**
 * scoreChangeHelpers (A-08f3e2): Weiche der Schnelleingabe nach dem Status der Engine-Ansicht NACH `catchUp`
 * (Plan § 1.3 Nr. 3, N-4). Die K.-o.-Auflösung liegt in `hooks/koSlotResolution.ts` (Fixrunde 1, I-1).
 */
import type { MatchStatus } from '../../../core/match';

/** enter = `RESULT_ENTRY`, correct = `CORRECTION` mit Grund, unskip = Rückfrage + Stapel, running = Ablehnung. */
export type ResultEntryRoute = 'enter' | 'correct' | 'unskip' | 'running';

export function routeForStatus(status: MatchStatus): ResultEntryRoute {
  switch (status) {
    case 'scheduled':
      return 'enter';
    case 'finished':
      return 'correct';
    case 'skipped':
      return 'unskip';
    default:
      return 'running';
  }
}
