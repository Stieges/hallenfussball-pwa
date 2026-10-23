/**
 * Echter Zustand „Gruppe abgeschlossen“ aus den Abschlüssen des Turniers (GA4 A-13b-C, @TM-046, @TM-099, @W2A-070).
 * Ersetzt die Zwischenregel `groupClosedByFollowUp` (Review TB-3' Auflage A1): „abgeschlossen“ heißt, die Turnierleitung hat
 * „Gruppe abschließen“ gewählt und die Gruppe nicht wieder geöffnet – unabhängig davon, ob es Folgespiele gibt (Nikolaus
 * hat keine). Gruppe immer über `groupKeyOf` (R-GA4v2-7). Rein, ohne React; liegt hier (nicht im Dienst), damit
 * `tieViews.ts` und `GroupCompletionService.ts` sich nicht gegenseitig importieren.
 */
import type { GroupCompletion, Tournament } from '../../types/tournament';
import { groupKeyOf } from '../models/standingsGroups';

type WithCompletions = Pick<Tournament, 'groupCompletions'>;

const completionsOf = (tournament: WithCompletions, groupId: string): GroupCompletion[] =>
  (tournament.groupCompletions ?? []).filter((c) => groupKeyOf(c.groupId) === groupId);

/** Geltender Abschluss der Gruppe (vorhanden und nicht wieder geöffnet) oder `undefined`. */
export function activeCompletion(tournament: WithCompletions, groupId: string): GroupCompletion | undefined {
  return completionsOf(tournament, groupId).find((c) => c.reopenedAt === undefined);
}

/** War die Gruppe schon einmal abgeschlossen (auch wenn wieder geöffnet)? Dann heißt die Taste „Erneut abschließen“. */
export function everCompleted(tournament: WithCompletions, groupId: string): boolean {
  return completionsOf(tournament, groupId).length > 0;
}

/** Ist die Gruppe abgeschlossen (Abschluss vorhanden und nicht wieder geöffnet)? Danach gibt es kein Zurücknehmen mehr. */
export function groupClosedFromCompletions(tournament: WithCompletions, groupId: string): boolean {
  return activeCompletion(tournament, groupId) !== undefined;
}
