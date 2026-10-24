/**
 * „Gruppe abschließen“ und Entscheidungen im lokalen Speicher (GA4 A-13b-C; Gast und Tests, `LocalStorageRepository`).
 * Reine Funktionen auf dem Turnier: dieselben Ergebnisse wie die Server-Funktionen, soweit ein einzelnes Gerät sie
 * braucht – Versionsprüfung der Entscheidung (`STALE`), kein Zurücknehmen nach dem Abschluss (`WITHDRAW_NOT_ALLOWED`),
 * Wiederöffnen nur nach einem Abschluss (`NOT_COMPLETED`). Folgespiele besetzt der Client wie bisher selbst (A-15b);
 * den Verlauf (Person, Zeit) gibt es lokal nicht.
 * GA4 A-13c: Der Abschluss besetzt die Finalrunde auch lokal (`placeFollowUps`, Zwilling von `apply_follow_up`), denn der alte Weg
 * „letztes Gruppenspiel besetzt automatisch“ ist entfernt (@TM-044, @TM-016).
 */
import type { GroupCompletion, StandingDecision, Tournament } from '../../types/tournament';
import { groupKeyOf } from '../models/standingsGroups';
import { activeCompletion } from '../standings/groupCompletions';
import { parseStandingDecisions } from '../models/schemas/StandingDecisionSchema';
import { placeFollowUps } from '../services/followUpPlacement';
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

/**
 * Abschluss einer Gruppe: neue Entscheidungen übernehmen, Abschluss mit Rangfolge eintragen (ersetzt einen alten der Gruppe).
 * `queued` (A-15c, @W2A-062, @TM-146, @TM-147): ohne Netz auf einem Cloud-Turnier – sofort wirksam, der Abschluss trägt die Marke
 * „noch nicht gesendet“ und die Version bleibt (sie zählt nur der Server hoch; sonst hielte das Gerät den Server-Stand nach dem
 * Nachreichen für nicht neuer und prüfte spätere Speicherungen gegen eine falsche Basis).
 */
export function applyCompleteGroup(tournament: Tournament, request: CompleteGroupRequest, options: { queued?: boolean } = {}): LocalChange<CompleteGroupResult> {
  const groupId = groupKeyOf(request.groupId);
  const queued = options.queued === true;
  const known = new Set((tournament.standingDecisions ?? []).map((d) => d.id));
  const added = request.tieDecisions.filter((d) => !known.has(d.id)).map(withoutReason);
  const completion: GroupCompletion = {
    groupId, ranking: [...request.ranking], openRanks: [...request.openRanks], stale: request.openRanks.length > 0, completedAt: nowIso(),
    ...(queued ? { unsent: true } : {}),
  };
  const others = (tournament.groupCompletions ?? []).filter((c) => groupKeyOf(c.groupId) !== groupId);
  const version = tournament.version ?? 0;
  const bump = added.length > 0 && !queued;
  const standingDecisions = added.length === 0 ? tournament.standingDecisions : parseStandingDecisions([...(tournament.standingDecisions ?? []), ...added]);
  const closed: Tournament = {
    ...tournament,
    groupCompletions: [...others, completion],
    ...(standingDecisions !== undefined ? { standingDecisions } : {}),
    ...(bump ? { version: version + 1 } : {}),
  };
  const placed = placeFollowUps(closed, groupId, request.ranking, request.openRanks);
  return {
    tournament: placed.tournament,
    result: { status: 'ok', alreadyCompleted: false, changed: placed.changed, ...(bump ? { tournamentVersion: version + 1 } : {}), ...(queued ? { queued: true } : {}) },
  };
}

/** A-15c: der Server hat den nachgereichten Abschluss angenommen – die Marke „noch nicht gesendet“ fällt weg. */
export function applyCompletionSent(tournament: Tournament, groupId: string): LocalChange<void> {
  const key = groupKeyOf(groupId);
  const list = tournament.groupCompletions ?? [];
  if (!list.some((c) => groupKeyOf(c.groupId) === key && c.unsent === true)) {
    return { result: undefined };
  }
  const groupCompletions = list.map((c) => {
    if (groupKeyOf(c.groupId) !== key || c.unsent !== true) {
      return c;
    }
    const { unsent: _unsent, ...sent } = c;
    return sent;
  });
  return { tournament: { ...tournament, groupCompletions }, result: undefined };
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
