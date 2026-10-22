/**
 * Wer hat wann eine Gleichstands-Entscheidung eingetragen oder zurückgenommen? (GA4 A-13b-C, @W2A-004, @W2A-060,
 * @W2A-063, @W2A-070, @W2A-071, @ET-027, @ET-029). Die Angabe kommt allein aus dem Verlauf der Turnierleitung
 * (`Tournament.decisionLog`, Server `bracket_log_read`) – im öffentlich lesbaren Datensatz steht sie nie (@W2A-072).
 * Rein, ohne React.
 */
import type { BracketLogEntry, Tournament } from '../../types/tournament';

/** Person und Zeit einer Eintragung. `name` fehlt, wenn die Person keinen Namen hat (nie die E-Mail). */
export interface DecisionAuthor {
  name?: string;
  at: string;
}

const idOf = (entry: BracketLogEntry): unknown => entry.detail.id;

/** Letzte Eintragung der Entscheidung `decisionId` oder `undefined` (kein Verlauf, kein Recht, vor G1). */
export function decidedBy(tournament: Pick<Tournament, 'decisionLog'>, decisionId: string): DecisionAuthor | undefined {
  const entry = [...(tournament.decisionLog ?? [])].reverse()
    .find((e) => e.kind === 'standing_decision' && idOf(e) === decisionId);
  return entry === undefined ? undefined : { ...(entry.actorName !== undefined ? { name: entry.actorName } : {}), at: entry.at };
}

/** Letzte Rücknahme der Entscheidung `decisionId` oder `undefined`. */
export function withdrawnBy(tournament: Pick<Tournament, 'decisionLog'>, decisionId: string): DecisionAuthor | undefined {
  const entry = [...(tournament.decisionLog ?? [])].reverse()
    .find((e) => e.kind === 'standing_withdraw' && idOf(e) === decisionId);
  return entry === undefined ? undefined : { ...(entry.actorName !== undefined ? { name: entry.actorName } : {}), at: entry.at };
}
