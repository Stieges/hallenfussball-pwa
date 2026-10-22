/**
 * Test-Hilfen A-19a: Gleichstand entscheiden wie die Turnierleitung (Dienst TB-3', echte Grundlage) und „Gruppe abschließen“
 * wie am Server (`complete_group` übernimmt die Rangfolge aus `prepareGroupCompletion`, Spiegel `groupCompletions`).
 * Nur Testumgebung.
 */
import type { Tournament } from '../../../../types/tournament';
import type { DecisionDraft } from '../../decisions';
import { prepareGroupCompletion } from '../../../services/GroupCompletionService';
import { MemoryRepo } from '../../__tests__/decisionTestKit';
import { completion } from '../../__tests__/groupCompletionKit';
import type { FinalStandingRow } from '../types';

/** Entscheidung eintragen; wirft bei Ablehnung. */
export async function decide(t: Tournament, draft: DecisionDraft): Promise<Tournament> {
  const repo = new MemoryRepo({ ...t, version: t.version ?? 1 });
  const result = await repo.service().decide(repo.tournament.id, draft);
  if (!result.ok) {
    throw new Error(`Entscheidung abgelehnt: ${result.code}`);
  }
  return repo.tournament;
}

/** „Gruppe abschließen“: nur wenn bereit; die Rangfolge steht danach im Abschluss. */
export function completeGroup(t: Tournament, groupId = ''): Tournament {
  const prepared = prepareGroupCompletion(t, groupId);
  if (prepared.code !== 'READY') {
    throw new Error(`Gruppe nicht bereit: ${prepared.code}`);
  }
  return { ...t, groupCompletions: [...(t.groupCompletions ?? []), completion(groupId, prepared.ranking)] };
}

/** Teamname und Platzziffer je Zeile, in Endstand-Reihenfolge. */
export const placed = (ranking: readonly FinalStandingRow[]): Array<[string, number]> =>
  ranking.map((row) => [row.teamName, row.place]);
