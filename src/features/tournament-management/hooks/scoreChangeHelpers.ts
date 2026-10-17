/**
 * scoreChangeHelpers (A-08f3e2): reine Funktionen der Schnelleingabe im Spielplan.
 * - `routeForStatus`: Weiche nach dem Status der Engine-Ansicht NACH `catchUp` (Plan § 1.3 Nr. 3, N-4).
 * - `slotUpdatesAfterResult`: K.-o.-Auflösung (H-2) -- nur Slots, nie ein Spielstand.
 * - `withEngineResult`: das Turnier mit dem gerade eingetragenen Engine-Stand eines Spiels.
 */
import type { Tournament } from '../../../types/tournament';
import type { MatchUpdate } from '../../../core/models/types';
import type { MatchStatus } from '../../../core/match';
import { applyEngineOverlay, engineOverlayFields, type MatchEngineView } from '../../../core/match/client';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../../core/generators';
import type { ValidMatchEntry } from '../../../hooks/engineMatchModel';

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

/** Turnier mit der aktuellen Engine-Ansicht EINES Spiels überlagert (React hat evtl. noch nicht neu gerendert). */
export function withEngineResult(tournament: Tournament, entry: ValidMatchEntry, view: MatchEngineView | null): Tournament {
  if (!view) {
    return tournament;
  }
  return applyEngineOverlay(tournament, new Map([[entry.externalId, engineOverlayFields(view, entry.ctx)]]));
}

/**
 * H-2 (Plan A-08f3 v4): Playoff-Anschluss und Bracket-Platzhalter nach einem Ergebnis. Grundlage ist das
 * überlagerte Turnier; zurück kommen NUR Slot-Updates (die Cloud übernimmt Seiten nur aus den Slots, A-02/A-03).
 * Die Resolver schreiben `tournament.matches` neu -- deshalb auf einer flachen Kopie.
 */
export function slotUpdatesAfterResult(tournament: Tournament): MatchUpdate[] {
  const working: Tournament = { ...tournament };
  const ids = new Set<string>();
  const playoff = autoResolvePlayoffsIfReady(working);
  if (playoff?.wasResolved) {
    playoff.updatedMatchIds.forEach((id) => ids.add(id));
  }
  const bracket = resolveBracketAfterPlayoffMatch(working);
  if (bracket?.wasResolved) {
    bracket.updatedMatchIds.forEach((id) => ids.add(id));
  }
  return [...ids].flatMap((id) => {
    const resolved = working.matches.find((m) => m.id === id);
    return resolved ? [{ id, slotA: resolved.slotA, slotB: resolved.slotB }] : [];
  });
}
