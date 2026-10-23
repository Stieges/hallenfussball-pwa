/**
 * Cloud-Wege für „Gruppe abschließen“ und die Gleichstands-Entscheidungen (GA4 A-13b-C, Migration `20261110_006`):
 * `complete_group`, `reopen_group`, `record_standing_decision` (Schreiben, nur über RPC – ersetzt den REST-Schreibweg
 * `standingDecisionsCloud.ts`, R-GA4v2-1) und das Lesen der Abschlüsse (`group_completions`).
 *
 * Muster `resetMatchResultsRpc.ts`: nur `.rpc`/`.from().select`, Antwort per zod geprüft, `src/types/supabase.ts` kennt
 * die Funktionen erst nach dem Typen-PR (deshalb ohne Typbindung). Fehlerpolitik:
 * - `42501` (kein Recht, Papierkorb) ist kein Fehler, sondern das Ergebnis `forbidden`;
 * - `40P01` (Verklemmung) und `55P03` (Sperr-Wartezeit) werfen `RetryLaterError` – nichts geschrieben, neuer Versuch erlaubt;
 * - alles andere (auch „Funktion fehlt“ vor dem Einspielen, PGRST202/42883) wirft `RepositoryError`.
 * Die Rangfolge, Entscheidungen und der Stand kommen vom Gerät (R-GA4-2, R-GA4v2-3); der Server prüft sie.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { GroupCompletion, StandingDecision } from '../../types/tournament';
import type { ExpectedMatchState } from '../services/GroupCompletionService';
import { CloudReadAbortedError, isAbortError, RepositoryError, RetryLaterError } from '../errors';

type RpcError = { code?: string; message: string };
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;

/** Gleichstands-Entscheidung für den Server; der Grund einer Reihenfolge reist mit, steht aber nie im `config` (@W2A-072). */
export type DecisionWithReason = StandingDecision & { reason?: string };

export interface CompleteGroupRequest {
  /** Gruppe wie `groupKeyOf` (`''` bei Jeder gegen jeden). */
  groupId: string;
  ranking: readonly string[];
  /** Plätze, die nach einer Korrektur auf ihre Herkunft zurückgehen (@TM-145); sonst leer. */
  openRanks: readonly number[];
  /** Gültige Entscheidungen der Gruppe; neue (aus der Warteschlange) mit Grund bei einer Reihenfolge. */
  tieDecisions: readonly DecisionWithReason[];
  /** Kennungen der Entscheidungen, die das Gerät kannte (F9, @TM-146 Z3). */
  knownDecisionIds: readonly string[];
  expectedState: readonly ExpectedMatchState[];
  /** Aus der Warteschlange: Konflikte werden zur Klärung statt abgelehnt (A-15c). */
  fromQueue?: boolean;
}

const LastSchema = z.object({
  actor: z.string().nullish(),
  kind: z.string(),
  at: z.string(),
  detail: z.record(z.string(), z.unknown()).nullish(),
});

/** Letzte Änderung am Server (`bracket_log`), wenn ein Konflikt auf eine Änderung zurückgeht. `actor` ist eine Kennung. */
export interface ServerLast {
  actor?: string;
  kind: string;
  at: string;
  detail: Record<string, unknown>;
}

const toLast = (last: z.infer<typeof LastSchema> | null | undefined): ServerLast | undefined =>
  last === null || last === undefined
    ? undefined
    : { ...(last.actor !== null && last.actor !== undefined ? { actor: last.actor } : {}), kind: last.kind, at: last.at, detail: last.detail ?? {} };

/** Konflikte, die aus der Warteschlange als Klärung landen (`clarifications.conflict_code`). */
export const CONFLICT_CODES = ['STALE_VERSION', 'MATCH_STARTED', 'COMPLETED_DIFFERENTLY', 'GROUP_REOPENED', 'NOT_COMPLETED', 'DECIDED_ELSEWHERE', 'SHARED_NOT_ALLOWED'] as const;
export type ConflictCode = typeof CONFLICT_CODES[number];

const COMPLETE_REJECTIONS = ['INVALID_INPUT', 'UNKNOWN_GROUP', 'STALE_VERSION', 'OPEN_MATCHES', 'RANKING_MISMATCH', 'COMPLETED_DIFFERENTLY',
  'GROUP_REOPENED', 'TIE_DECISION_REQUIRED', 'SHARED_NOT_ALLOWED', 'DECIDED_ELSEWHERE', 'INVALID_TIE_DECISIONS', 'REASON_REQUIRED'] as const;
export type CompleteGroupRejection = typeof COMPLETE_REJECTIONS[number];

const CompleteResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    code: z.literal('ALREADY_COMPLETED').optional(),
    changed: z.array(z.object({ matchId: z.string(), side: z.enum(['A', 'B']), result: z.string() })).optional(),
    tournamentVersion: z.number().int().nullish(),
  }),
  z.object({ status: z.literal('rejected'), code: z.enum(COMPLETE_REJECTIONS), open: z.number().int().optional(), last: LastSchema.nullish() }),
  z.object({ status: z.literal('clarification'), code: z.enum(CONFLICT_CODES), clarificationId: z.number().int(), last: LastSchema.nullish() }),
]);

export interface FollowUpChange {
  matchId: string;
  side: 'A' | 'B';
  result: string;
}

export type CompleteGroupResult =
  | { status: 'ok'; alreadyCompleted: boolean; changed: FollowUpChange[]; tournamentVersion?: number; /** A-15c: ohne Netz lokal wirksam, wird nachgereicht. */ queued?: boolean }
  | { status: 'rejected'; code: CompleteGroupRejection; open?: number; last?: ServerLast }
  | { status: 'clarification'; code: ConflictCode; clarificationId: number; last?: ServerLast }
  | { status: 'forbidden' };

const ReopenResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('rejected'), code: z.enum(['INVALID_INPUT', 'REASON_REQUIRED', 'NOT_COMPLETED']), last: LastSchema.nullish() }),
  z.object({ status: z.literal('clarification'), code: z.enum(CONFLICT_CODES), clarificationId: z.number().int(), last: LastSchema.nullish() }),
]);

export type ReopenGroupResult =
  | { status: 'ok' }
  | { status: 'rejected'; code: 'INVALID_INPUT' | 'REASON_REQUIRED' | 'NOT_COMPLETED'; last?: ServerLast }
  | { status: 'clarification'; code: ConflictCode; clarificationId: number; last?: ServerLast }
  | { status: 'forbidden' };

export type RecordDecisionRequest =
  | { action: 'decide'; decision: StandingDecision; /** Nur bei einer Reihenfolge (3+ Teams); steht nur im Verlauf (@W2A-072). */ reason?: string }
  | { action: 'withdraw'; decision: Pick<StandingDecision, 'id'> };

const RECORD_REJECTIONS = ['INVALID_INPUT', 'INVALID_DECISION', 'DUPLICATE_ID', 'NOT_FOUND', 'STALE', 'REASON_REQUIRED', 'WITHDRAW_NOT_ALLOWED'] as const;
export type RecordDecisionRejection = typeof RECORD_REJECTIONS[number];

const RecordResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), code: z.literal('ALREADY_APPLIED').optional(), version: z.number().int() }),
  z.object({ status: z.literal('rejected'), code: z.enum(RECORD_REJECTIONS), version: z.number().int().nullish() }),
]);

export type RecordDecisionResult =
  | { status: 'ok'; alreadyApplied: boolean; version: number }
  | { status: 'rejected'; code: RecordDecisionRejection; version?: number }
  | { status: 'forbidden' };

function requireRpc(client: SupabaseClient<Database> | null, operation: string): UntypedRpc {
  if (!client) {
    throw new RepositoryError(operation, 'Supabase ist nicht konfiguriert');
  }
  return client.rpc.bind(client) as unknown as UntypedRpc;
}

/** Ruft eine Funktion auf; `null` = kein Recht (42501), sonst die rohe Antwort. Verklemmung/Wartezeit → `RetryLaterError`. */
async function callRpc(rpc: UntypedRpc, operation: string, fn: string, args: Record<string, unknown>): Promise<unknown> {
  let response: Awaited<ReturnType<UntypedRpc>>;
  try {
    response = await rpc(fn, args);
  } catch (error) {
    throw new RepositoryError(operation, 'Übertragung fehlgeschlagen', error);
  }
  if (response.error) {
    const { code, message } = response.error;
    if (code === '42501') {
      return null;
    }
    if (code === '40P01' || code === '55P03') {
      throw new RetryLaterError(operation, code);
    }
    throw new RepositoryError(operation, message, response.error);
  }
  return response.data;
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, operation: string, fn: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new RepositoryError(operation, `Unerwartete Antwort von ${fn}`, parsed.error);
  }
  return parsed.data;
}

/** Argumente von `complete_group` (Namen wie die Funktion). */
export function completeGroupArgs(tournamentId: string, request: CompleteGroupRequest): Record<string, unknown> {
  return {
    p_tournament_id: tournamentId,
    p_group_id: request.groupId,
    p_ranking: [...request.ranking],
    p_open_ranks: [...request.openRanks],
    p_tie_decisions: request.tieDecisions.map((d) => ({ ...d })),
    p_known_decision_ids: [...request.knownDecisionIds],
    p_expected_state: request.expectedState.map((s) => ({ ...s })),
    p_from_queue: request.fromQueue === true,
  };
}

export async function callCompleteGroup(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  request: CompleteGroupRequest,
): Promise<CompleteGroupResult> {
  const operation = 'completeGroup';
  const data = await callRpc(requireRpc(client, operation), operation, 'complete_group', completeGroupArgs(tournamentId, request));
  if (data === null) {
    return { status: 'forbidden' };
  }
  const response = parseOrThrow(CompleteResponseSchema, data, operation, 'complete_group');
  switch (response.status) {
    case 'ok':
      return {
        status: 'ok',
        alreadyCompleted: response.code === 'ALREADY_COMPLETED',
        changed: response.changed ?? [],
        ...(response.tournamentVersion !== null && response.tournamentVersion !== undefined ? { tournamentVersion: response.tournamentVersion } : {}),
      };
    case 'rejected': {
      const last = toLast(response.last);
      return { status: 'rejected', code: response.code, ...(response.open !== undefined ? { open: response.open } : {}), ...(last !== undefined ? { last } : {}) };
    }
    case 'clarification': {
      const last = toLast(response.last);
      return { status: 'clarification', code: response.code, clarificationId: response.clarificationId, ...(last !== undefined ? { last } : {}) };
    }
  }
}

export async function callReopenGroup(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  groupId: string,
  reason: string,
  fromQueue = false,
): Promise<ReopenGroupResult> {
  const operation = 'reopenGroup';
  const data = await callRpc(requireRpc(client, operation), operation, 'reopen_group',
    { p_tournament_id: tournamentId, p_group_id: groupId, p_reason: reason, p_from_queue: fromQueue });
  if (data === null) {
    return { status: 'forbidden' };
  }
  const response = parseOrThrow(ReopenResponseSchema, data, operation, 'reopen_group');
  if (response.status === 'ok') {
    return { status: 'ok' };
  }
  const last = toLast(response.last);
  return response.status === 'rejected'
    ? { status: 'rejected', code: response.code, ...(last !== undefined ? { last } : {}) }
    : { status: 'clarification', code: response.code, clarificationId: response.clarificationId, ...(last !== undefined ? { last } : {}) };
}

/** Argumente von `record_standing_decision`: der Grund reist nur bei einer Reihenfolge mit (nie bei Annahme, Strafstoßschießen, Rücknahme). */
export function recordDecisionArgs(tournamentId: string, request: RecordDecisionRequest, expectedVersion: number): Record<string, unknown> {
  const reason = request.action === 'decide' && request.decision.kind === 'order' ? request.reason : undefined;
  return {
    p_tournament_id: tournamentId,
    p_action: request.action,
    p_decision: { ...request.decision },
    p_reason: reason ?? null,
    p_expected_version: expectedVersion,
  };
}

export async function callRecordStandingDecision(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  request: RecordDecisionRequest,
  expectedVersion: number,
): Promise<RecordDecisionResult> {
  const operation = 'recordStandingDecision';
  const data = await callRpc(requireRpc(client, operation), operation, 'record_standing_decision', recordDecisionArgs(tournamentId, request, expectedVersion));
  if (data === null) {
    return { status: 'forbidden' };
  }
  const response = parseOrThrow(RecordResponseSchema, data, operation, 'record_standing_decision');
  return response.status === 'ok'
    ? { status: 'ok', alreadyApplied: response.code === 'ALREADY_APPLIED', version: response.version }
    : { status: 'rejected', code: response.code, ...(response.version !== null && response.version !== undefined ? { version: response.version } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Lesen: group_completions (RLS: Turnierleitung und Helfer; Zuschauer ohne Zeilen)
// ---------------------------------------------------------------------------------------------------------------------

const CompletionRowSchema = z.object({
  group_id: z.string(),
  ranking: z.array(z.string()),
  open_ranks: z.array(z.number().int()),
  completed_at: z.string(),
  stale: z.boolean(),
  reopened_at: z.string().nullable(),
});

export type GroupCompletionRow = z.infer<typeof CompletionRowSchema>;

/** Spalten, die die App liest – Person (`completed_by`) und Rohdaten (`tie_orders`, `based_on_state`) gehören nicht dazu (@W2A-072). */
export const GROUP_COMPLETION_COLUMNS = 'group_id, ranking, open_ranks, completed_at, stale, reopened_at';

/** Zeile `group_completions` → `Tournament.groupCompletions`. */
export function mapGroupCompletionRow(row: GroupCompletionRow): GroupCompletion {
  return {
    groupId: row.group_id,
    ranking: [...row.ranking],
    openRanks: [...row.open_ranks],
    stale: row.stale,
    completedAt: row.completed_at,
    ...(row.reopened_at !== null ? { reopenedAt: row.reopened_at } : {}),
  };
}

type UntypedFrom = (table: string) => {
  select: (columns: string) => { eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: RpcError | null }> };
};

/** Tabelle fehlt (vor dem Einspielen von `_006`): PostgREST `PGRST205`, Postgres `42P01`. */
const isMissingTable = (code: string | undefined): boolean => code === 'PGRST205' || code === '42P01';

/** Kein Leserecht (`42501`): Geräte ohne Anmeldung, etwa der Hallen-Monitor (`anon` hat kein SELECT auf `group_completions`). */
const isNoAccess = (code: string | undefined): boolean => code === '42501';

/**
 * Lesen der Abschlüsse eines Turniers. `undefined` = Tabelle gibt es (noch) nicht oder das Gerät darf sie nicht lesen (anon,
 * Hallen-Monitor, `42501`) – dann gilt der Abschluss als unbekannt und der lokale Stand bleibt; ein anderer Fehler wirft `RepositoryError` wie das Lesen von Teams und Spielen.
 */
export async function readGroupCompletions(client: SupabaseClient<Database>, tournamentId: string): Promise<GroupCompletion[] | undefined> {
  const from = client.from.bind(client) as unknown as UntypedFrom;
  const { data, error } = await from('group_completions').select(GROUP_COMPLETION_COLUMNS).eq('tournament_id', tournamentId);
  if (error) {
    if (isMissingTable(error.code) || isNoAccess(error.code)) {
      return undefined;
    }
    if (isAbortError(error)) {
      throw new CloudReadAbortedError(error);
    }
    throw new RepositoryError('get', error.message, error);
  }
  const parsed = z.array(CompletionRowSchema).safeParse(data);
  if (!parsed.success) {
    throw new RepositoryError('get', 'Unerwartete Antwort von group_completions', parsed.error);
  }
  return parsed.data.map(mapGroupCompletionRow).sort((x, y) => (x.groupId < y.groupId ? -1 : x.groupId > y.groupId ? 1 : 0));
}
