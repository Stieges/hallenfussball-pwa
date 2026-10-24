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

/** Höchste Kennung im Verlauf, den das Gerät gerade kennt (0 ohne Verlauf). */
export function lastLogId(tournament: Pick<Tournament, 'decisionLog'>): number {
  return (tournament.decisionLog ?? []).reduce((max, e) => Math.max(max, e.id), 0);
}

const GROUP_EVENTS = new Set<BracketLogEntry['kind']>(['complete_group', 'reopen_group', 'standing_decision', 'standing_withdraw']);

/**
 * @W2A-060 (Review #382 M2/M3): Wer hat in Gruppe `groupId` zuletzt `kind` eingetragen – aber nur, wenn dieser Eintrag NACH
 * `afterId` (Stand beim Absenden) ins Gerät kam und danach nichts anderes in der Gruppe geschah (kein Wiederöffnen, keine
 * Rücknahme). Sonst `undefined`, dann gilt der allgemeine Text. So nennt der Hinweis nie einen alten Eintrag – etwa die
 * Person selbst –, solange der frische Verlauf fehlt oder nicht lesbar ist.
 */
export function newGroupActor(
  tournament: Pick<Tournament, 'decisionLog'>, groupId: string, kind: 'complete_group' | 'standing_decision', afterId: number,
): string | undefined {
  const last = [...(tournament.decisionLog ?? [])].reverse()
    .find((e) => GROUP_EVENTS.has(e.kind) && groupKeyOf(e.groupId ?? '') === groupId);
  return last?.kind === kind && last.id > afterId ? last.actorName : undefined;
}
