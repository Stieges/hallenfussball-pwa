/**
 * A-15b (R2 PR 2): Neu besetzen nach einer Korrektur – rein, ohne React. Welche Gruppen muss das Gerät der Turnierleitung nach
 * einer angenommenen Korrektur erneut abschließen, und mit welcher Anfrage?
 *
 * - Eine abgeschlossene Gruppe, die der Server nach einer Korrektur als veraltet markiert hat (`stale`), wird ohne Zutun erneut
 *   abgeschlossen (@TM-071, @TM-150 Zeile 2), über `planCompletion(…, 'auto')`: offene Plätze mit Folgespiel gehen auf ihre
 *   Herkunft zurück (@TM-145), ein Gleichstand auf einem auszuspielenden Platz ohne Folgespiel verlangt die Entscheidung –
 *   dann gibt es keine Anfrage, „Besetzung prüfen“ bleibt stehen (@TM-150 Zeile 1).
 * - Im lokalen Speicher (Gast) markiert niemand `stale`: dort gilt eine abgeschlossene Gruppe als veraltet, wenn ihre
 *   gespeicherte Rangfolge nicht mehr zur Tabelle passt (Befund C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING).
 */
import type { Tournament } from '../../types/tournament';
import type { CompleteGroupRequest } from '../repositories/groupCompletionCloud';
import { activeCompletion, activeRanking, groupIds, groupState } from './GroupCompletionService';
import { planCompletion } from './groupCompletionPlan';

const sameOrder = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Gruppen, die erneut abzuschließen sind: vom Server als veraltet markiert, bei `local` auch abgeschlossene Gruppen, deren
 * gespeicherte Rangfolge nicht mehr zur gerechneten passt.
 */
export function groupsToRecomplete(tournament: Tournament, options: { local: boolean }): string[] {
  return groupIds(tournament).filter((groupId) => {
    if (groupState(tournament, groupId) === 'stale') {
      return true;
    }
    const completion = activeCompletion(tournament, groupId);
    return options.local && completion !== undefined && !sameOrder(completion.ranking, activeRanking(tournament, groupId));
  });
}

/** Die abgeschlossene Gruppe als veraltet behandeln (Gast: dort setzt kein Server `stale`). */
function asStale(tournament: Tournament, groupId: string): Tournament {
  if (groupState(tournament, groupId) === 'stale') {
    return tournament;
  }
  const current = activeCompletion(tournament, groupId);
  return {
    ...tournament,
    groupCompletions: (tournament.groupCompletions ?? []).map((c) => (c === current ? { ...c, stale: true } : c)),
  };
}

/**
 * Anfrage für den erneuten Abschluss nach einer Korrektur oder `null`, wenn erst entschieden werden muss (oder nichts zu tun
 * ist). Immer mit den Regeln des erneuten Abschlusses (`auto`), auch für eine Gruppe aus `groupsToRecomplete(…, local)`.
 */
export function reassignAfterCorrection(tournament: Tournament, groupId: string): CompleteGroupRequest | null {
  if (activeCompletion(tournament, groupId) === undefined) {
    return null;
  }
  const plan = planCompletion(asStale(tournament, groupId), groupId, [], 'auto');
  return plan.code === 'READY' ? plan.request : null;
}
