/**
 * Wer hat wann eine Gleichstands-Entscheidung eingetragen oder zurückgenommen? (GA4 A-13b-C, @W2A-004, @W2A-060,
 * @W2A-063, @W2A-070, @W2A-071, @ET-027, @ET-029). Die Angabe kommt allein aus dem Verlauf der Turnierleitung
 * (`Tournament.decisionLog`, Server `bracket_log_read`) – im öffentlich lesbaren Datensatz steht sie nie (@W2A-072).
 * Rein, ohne React.
 */
import type { BracketLogEntry, Tournament } from '../../types/tournament';
import { sameTeamSet } from './decisions';

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

const teamIdsOf = (entry: BracketLogEntry): string[] | undefined => {
  const ids = entry.detail.teamIds;
  return Array.isArray(ids) && ids.every((id): id is string => typeof id === 'string') ? ids : undefined;
};

/** Letzter Verlaufseintrag (Entscheidung oder Rücknahme) über genau diese Teams. */
function lastBlockEntry(tournament: Pick<Tournament, 'decisionLog'>, teamIds: readonly string[]): BracketLogEntry | undefined {
  return [...(tournament.decisionLog ?? [])].reverse().find((e) => {
    const ids = teamIdsOf(e);
    return (e.kind === 'standing_decision' || e.kind === 'standing_withdraw') && ids !== undefined && sameTeamSet(ids, teamIds);
  });
}

const authorOf = (entry: BracketLogEntry): DecisionAuthor => ({ ...(entry.actorName !== undefined ? { name: entry.actorName } : {}), at: entry.at });

/**
 * Wurde die letzte Entscheidung über genau diese Teams zurückgenommen? (@W2A-070: „wer wann zurückgenommen hat“.) Gilt nur, wenn
 * die Rücknahme der LETZTE Verlaufseintrag zu diesen Teams ist; wurde danach neu entschieden, ist sie überholt.
 */
export function withdrawnForBlock(tournament: Pick<Tournament, 'decisionLog'>, teamIds: readonly string[]): DecisionAuthor | undefined {
  const last = lastBlockEntry(tournament, teamIds);
  return last?.kind === 'standing_withdraw' ? authorOf(last) : undefined;
}

/** Rücknahme mit der zurückgenommenen Entscheidung: wer sie wann eingetragen und wer sie wann zurückgenommen hat (GA4 A-13c, N2). */
export interface BlockWithdrawal {
  withdrawn: DecisionAuthor;
  /** Die zurückgenommene Entscheidung: Art und wer sie wann eingetragen hat; fehlt, wenn der Verlauf sie nicht mehr enthält. */
  decided?: DecisionAuthor & { kind: BracketLogEntry['detail']['kind'] };
}

export function withdrawalOfBlock(tournament: Pick<Tournament, 'decisionLog'>, teamIds: readonly string[]): BlockWithdrawal | undefined {
  const last = lastBlockEntry(tournament, teamIds);
  if (last?.kind !== 'standing_withdraw') {
    return undefined;
  }
  const entry = [...(tournament.decisionLog ?? [])].reverse().find((e) => e.kind === 'standing_decision' && idOf(e) === idOf(last));
  return { withdrawn: authorOf(last), ...(entry !== undefined ? { decided: { ...authorOf(entry), kind: entry.detail.kind } } : {}) };
}
