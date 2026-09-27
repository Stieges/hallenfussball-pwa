/**
 * scoreChangeHelpers (C3a-2a Fixrunde 3, P4/W11): aus `useScheduleTabActions.ts` ausgelagert,
 * damit die Datei < 300 Zeilen bleibt. Reine Funktionen (kein React) fuer `handleScoreChange`:
 * die Engine-Sperre (Fixrunde 2 Item 6 / P4) und die automatische Playoff-/Bracket-Anschluss-
 * Aufloesung (A2 Fixrunde 1).
 */
import type { Tournament } from '../../../types/tournament';
import type { MatchUpdate } from '../../../core/models/types';
import { diffMatchResultStatusUpdates } from '../../../core/services';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../../core/generators';
import { buildValidMatches, isNewScheduledMatch } from '../../../hooks/engineMatchModel';
import { isMatchRunning } from '../utils';

/**
 * Fixrunde 2/P4 (Fixrunde 3): ein Engine-Spiel darf NICHT mehr ueber die Schnelleingabe direkt
 * scoreA/scoreB geschrieben bekommen -- das umginge MatchCommands/die RPC komplett (kein
 * Ereignis, keine Projektion, kein Sync). Zwei Faelle zaehlen als Engine-Spiel: (1) bereits
 * laufend/beendet MIT echtem Engine-Inhalt (`overlaidMatchIds`, P4-Fix -- die reine B1-Klausel
 * allein sah nur NEUE Spiele, ein RUNNING/FINISHED Engine-Spiel rutschte durch); (2) B1-neu
 * (scheduled, kein Ergebnis) UND NICHT bereits ueber den Altweg (Legacy-`isMatchRunning`,
 * localStorage) in Betrieb -- sonst wuerde ein laufendes 0:0-Altspiel faelschlich geblockt
 * (Gegenprobe P4).
 */
export function isEngineControlledScoreChange(
  tournament: Tournament,
  matchId: string,
  overlaidMatchIds: ReadonlySet<string>,
): boolean {
  if (overlaidMatchIds.has(matchId)) {
    return true;
  }
  const engineEntry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
  return !isMatchRunning(matchId, tournament.id) && !!engineEntry && isNewScheduledMatch(engineEntry, new Map());
}

/**
 * A2 Fixrunde 1 (Ruling AJ, "nur einen Weg"): Playoff-Anschluss (`autoResolvePlayoffsIfReady`)
 * und Bracket-Platzhalter (`resolveBracketAfterPlayoffMatch`) nach einem Ergebnis -- ergaenzt
 * `pendingUpdates` (IN PLACE) um jedes davon betroffene Spiel (Team-Zuweisungen, ggf. per
 * `diffMatchResultStatusUpdates` auch ein Ergebnis-Reset, falls sich die Teams geaendert haben).
 */
export function applyAutoResolutionsAfterScoreChange(
  tournament: Tournament,
  updatedTournament: Tournament,
  pendingUpdates: Map<string, MatchUpdate>,
): void {
  const playoffResolution = autoResolvePlayoffsIfReady(updatedTournament);
  if (playoffResolution?.wasResolved) {
    for (const id of playoffResolution.updatedMatchIds) {
      const before = tournament.matches.find((m) => m.id === id);
      const resolved = updatedTournament.matches.find((m) => m.id === id);
      if (before && resolved) {
        const [resultUpdate] = diffMatchResultStatusUpdates([before], [resolved]);
        pendingUpdates.set(id, {
          ...(resultUpdate ?? { id }),
          teamA: resolved.teamA,
          teamB: resolved.teamB,
        });
      }
    }
  }

  const bracketResolution = resolveBracketAfterPlayoffMatch(updatedTournament);
  if (bracketResolution?.wasResolved) {
    for (const id of bracketResolution.updatedMatchIds) {
      const resolved = updatedTournament.matches.find((m) => m.id === id);
      if (resolved) {
        pendingUpdates.set(id, {
          ...pendingUpdates.get(id),
          id,
          teamA: resolved.teamA,
          teamB: resolved.teamB,
        });
      }
    }
  }
}
