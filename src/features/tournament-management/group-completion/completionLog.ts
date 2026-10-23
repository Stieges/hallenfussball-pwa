/**
 * Wer hat wann eine Gruppe abgeschlossen oder wieder geöffnet? Nur aus dem Verlauf der Turnierleitung
 * (`Tournament.decisionLog`, GA4 A-13b-C, @TM-046, @TM-072, @TM-113) – im öffentlich lesbaren Datensatz steht es nie.
 * Rein, ohne React.
 */
import type { BracketLogEntry, Tournament } from '../../../types/tournament';
import { groupKeyOf } from '../../../core/models/standingsGroups';

export interface LogPerson {
  name?: string;
  at: string;
  reason?: string;
}

/** Letzter Verlaufseintrag der Art `kind` zu Gruppe `groupId`; `undefined` ohne Verlauf (kein Recht, vor G1). */
export function lastGroupLog(tournament: Pick<Tournament, 'decisionLog'>, kind: 'complete_group' | 'reopen_group', groupId: string): LogPerson | undefined {
  const entry: BracketLogEntry | undefined = [...(tournament.decisionLog ?? [])].reverse()
    .find((e) => e.kind === kind && groupKeyOf(e.groupId ?? '') === groupId);
  return entry === undefined ? undefined : {
    ...(entry.actorName !== undefined ? { name: entry.actorName } : {}),
    at: entry.at,
    ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
  };
}
