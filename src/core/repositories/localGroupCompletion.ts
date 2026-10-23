/**
 * „Gruppe abschließen“ und Entscheidungen im lokalen Speicher (GA4 A-13b-C; Gast und Tests, `LocalStorageRepository`).
 * Reine Funktionen auf dem Turnier: dieselben Ergebnisse wie die Server-Funktionen, soweit ein einzelnes Gerät sie
 * braucht – Versionsprüfung der Entscheidung (`STALE`), kein Zurücknehmen nach dem Abschluss (`WITHDRAW_NOT_ALLOWED`),
 * Wiederöffnen nur nach einem Abschluss (`NOT_COMPLETED`). Folgespiele besetzt der Client wie bisher selbst (A-15b);
 * den Verlauf (Person, Zeit) gibt es lokal nicht.
 */
import type { GroupCompletion, StandingDecision, Tournament } from '../../types/tournament';
import { groupKeyOf } from '../models/standingsGroups';
import { activeCompletion } from '../standings/groupCompletions';
import { parseStandingDecisions } from '../models/schemas/StandingDecisionSchema';
import type {
  CompleteGroupRequest, CompleteGroupResult, RecordDecisionRequest, RecordDecisionResult, ReopenGroupResult,
} from './groupCompletionCloud';

export interface LocalChange<R> {
  /** Neuer Stand des Turniers oder `undefined`, wenn nichts zu schreiben ist. */
  tournament?: Tournament;
  result: R;
}

const nowIso = (): string => new Date().toISOString();

/** Entscheidung eintragen oder zurücknehmen; Versionsprüfung wie die Cloud. */
export function applyRecordDecision(tournament: Tournament, request: RecordDecisionRequest, expectedVersion: number): LocalChange<RecordDecisionResult> {
  const version = tournament.version ?? 0;
  const list = tournament.standingDecisions ?? [];
  const existing = list.find((d) => d.id === request.decision.id);
  if (request.action === 'decide' && existing !== undefined) {
    return { result: { status: 'rejected', code: 'DUPLICATE_ID', version } };
  }
  if (request.action === 'withdraw' && existing === undefined) {
    return { result: { status: 'rejected', code: 'NOT_FOUND', version } };
  }
  if (version !== expectedVersion) {
    return { result: { status: 'rejected', code: 'STALE', version } };
  }
  if (request.action === 'decide') {
    const next = parseStandingDecisions([...list, request.decision]) ?? list;
    return { tournament: { ...tournament, standingDecisions: next, version: version + 1 }, result: { status: 'ok', alreadyApplied: false, version: version + 1 } };
  }
  if (existing !== undefined && activeCompletion(tournament, existing.groupId) !== undefined) {
    return { result: { status: 'rejected', code: 'WITHDRAW_NOT_ALLOWED', version } };
  }
  return {
    tournament: { ...tournament, standingDecisions: list.filter((d) => d.id !== request.decision.id), version: version + 1 },
    result: { status: 'ok', alreadyApplied: false, version: version + 1 },
  };
}

const withoutReason = ({ reason: _reason, ...decision }: StandingDecision & { reason?: string }): StandingDecision => decision;

/** Abschluss einer Gruppe: neue Entscheidungen übernehmen, Abschluss mit Rangfolge eintragen (ersetzt einen alten der Gruppe). */
export function applyCompleteGroup(tournament: Tournament, request: CompleteGroupRequest): LocalChange<CompleteGroupResult> {
  const groupId = groupKeyOf(request.groupId);
  const known = new Set((tournament.standingDecisions ?? []).map((d) => d.id));
  const added = request.tieDecisions.filter((d) => !known.has(d.id)).map(withoutReason);
  const completion: GroupCompletion = {
    groupId, ranking: [...request.ranking], openRanks: [...request.openRanks], stale: request.openRanks.length > 0, completedAt: nowIso(),
  };
  const others = (tournament.groupCompletions ?? []).filter((c) => groupKeyOf(c.groupId) !== groupId);
  const version = tournament.version ?? 0;
  const standingDecisions = added.length === 0 ? tournament.standingDecisions : parseStandingDecisions([...(tournament.standingDecisions ?? []), ...added]);
  return {
    tournament: {
      ...tournament,
      groupCompletions: [...others, completion],
      ...(standingDecisions !== undefined ? { standingDecisions } : {}),
      ...(added.length > 0 ? { version: version + 1 } : {}),
    },
    result: { status: 'ok', alreadyCompleted: false, changed: [], ...(added.length > 0 ? { tournamentVersion: version + 1 } : {}) },
  };
}

/** Gruppe wieder öffnen: der Abschluss bleibt als Zeile, gilt aber nicht mehr (`reopenedAt`). */
export function applyReopenGroup(tournament: Tournament, groupId: string): LocalChange<ReopenGroupResult> {
  const key = groupKeyOf(groupId);
  if (activeCompletion(tournament, key) === undefined) {
    return { result: { status: 'rejected', code: 'NOT_COMPLETED' } };
  }
  const groupCompletions = (tournament.groupCompletions ?? []).map((c) =>
    groupKeyOf(c.groupId) === key && c.reopenedAt === undefined ? { ...c, reopenedAt: nowIso() } : c);
  return { tournament: { ...tournament, groupCompletions }, result: { status: 'ok' } };
}
