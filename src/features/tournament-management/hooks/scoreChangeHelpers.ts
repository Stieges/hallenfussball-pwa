/**
 * scoreChangeHelpers (C3a-2a Fixrunde 3, P4/W11): aus `useScheduleTabActions.ts` ausgelagert,
 * damit die Datei < 300 Zeilen bleibt. Reine Funktionen (kein React) fuer `handleScoreChange`:
 * die Engine-Sperre (Fixrunde 2 Item 6 / P4) und die automatische Playoff-/Bracket-Anschluss-
 * Aufloesung (A2 Fixrunde 1).
 */
import type { Match, Tournament } from '../../../types/tournament';
import type { MatchUpdate } from '../../../core/models/types';
import { diffMatchResultStatusUpdates } from '../../../core/services';
import { autoResolvePlayoffsIfReady, resolveBracketAfterPlayoffMatch } from '../../../core/generators';
import { buildValidMatches, isNewScheduledMatch, isForeignCandidate } from '../../../hooks/engineMatchModel';
import { isMatchRunning } from '../utils';

/**
 * Fixrunde 2/P4 (Fixrunde 3)/Minor 5 (Fixrunde 4): ein Engine-Spiel darf NICHT mehr ueber die
 * Schnelleingabe direkt scoreA/scoreB geschrieben bekommen -- das umginge MatchCommands/die RPC
 * komplett (kein Ereignis, keine Projektion, kein Sync). Drei Faelle zaehlen als Engine-Spiel:
 * (1) bereits laufend/beendet MIT echtem Engine-Inhalt (`overlaidMatchIds`, P4-Fix -- die reine
 * B1-Klausel allein sah nur NEUE Spiele, ein RUNNING/FINISHED Engine-Spiel rutschte durch);
 * (2) B1-neu (scheduled, kein Ergebnis) UND NICHT bereits ueber den Altweg (Legacy-
 * `isMatchRunning`, localStorage) in Betrieb -- sonst wuerde ein laufendes 0:0-Altspiel
 * faelschlich geblockt (Gegenprobe P4); (3) ein fremd laufendes Engine-Spiel, dessen Kopie auf
 * DIESEM Geraet noch nicht geladen ist (`isForeignCandidate`, Minor 5) -- steht (noch) NICHT in
 * `overlaidMatchIds`, ist aber dieselbe E1/P2-"unklar"-Einstufung: vorlaeufig sperren statt am
 * RPC vorbeizuschreiben.
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
  if (!engineEntry) {
    return false;
  }
  if (isForeignCandidate(engineEntry, new Map())) {
    return true;
  }
  const scoredMatch = tournament.matches.find((m) => m.id === matchId);
  return !(scoredMatch && isMatchRunning(scoredMatch)) && isNewScheduledMatch(engineEntry, new Map());
}

/**
 * @FU-080 / @TM-143 (B-40 Fixrunde 1/2): Beide Ergebnisse direkt im Spielplan eingetragen = Spiel ist
 * abgepfiffen (`finished`), sonst zählt es nicht in der Tabelle. Ein laufendes oder unterbrochenes Spiel
 * behält seinen Status (der Helfer steuert ihn). „Laufend/unterbrochen“ kommt aus der Live-Quelle
 * (`liveMatchIds` = useRunningMatchIds, auch lokale Pause/Halbzeit) oder dem gespeicherten Status
 * (die DB kennt zusätzlich 'paused') – nie aus einem eigenen localStorage-Lesen (@FU-087, Merge I1).
 */
export function finishesOnScoreEntry(
  match: Match,
  scoreA: number | undefined,
  scoreB: number | undefined,
  liveMatchIds: ReadonlySet<string>,
): boolean {
  const enteredBothScores = typeof scoreA === 'number' && typeof scoreB === 'number';
  const status = match.matchStatus as string | undefined;
  const isLive = liveMatchIds.has(match.id) || status === 'running' || status === 'paused';
  return enteredBothScores && !isLive;
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
          // A-03: die Cloud übernimmt Seiten nur aus den Slots (A-02) – ohne sie ginge die Auflösung verloren.
          slotA: resolved.slotA,
          slotB: resolved.slotB,
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
          // A-03: die Cloud übernimmt Seiten nur aus den Slots (A-02) – ohne sie ginge die Auflösung verloren.
          slotA: resolved.slotA,
          slotB: resolved.slotB,
        });
      }
    }
  }
}
