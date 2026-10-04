/**
 * replan — Neuplanung (Struktur ändern) vor dem ersten Anpfiff.
 *
 * Die Anpfiff-Prüfung nutzt die GEMEINSAME Funktion `getMatchStartState`
 * (src/utils/matchStartState.ts, @LZ-003 / B-01a) – keine Kopie.
 */
import type { Tournament } from '../../../types/tournament';
import { getMatchStartState } from '../../../utils/matchStartState';

export type ReplanAvailability = 'offered' | 'refused-after-kickoff';

export function getReplanAvailability(
  tournament: Pick<Tournament, 'matches' | 'status' | 'publishedAt'>
): ReplanAvailability {
  const isEstablished =
    tournament.status === 'published' || tournament.publishedAt !== undefined;
  const startState = getMatchStartState(
    tournament.matches,
    undefined,
    isEstablished
  );
  return startState === 'not-started' ? 'offered' : 'refused-after-kickoff';
}
