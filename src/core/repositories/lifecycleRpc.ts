/**
 * Client der Abschluss-Funktionen (Migration 20261113_003, Übergabe A-21a-C1 in `A-21a-sql-freigabe.md` § 9; Plan R3-2b):
 * `finish_preflight` (Liste offener Punkte, Warnungen, bestätigter Stand), `finish_tournament` (Abschluss mit `request_id`)
 * und `tournament_lifecycle` (Zustand vom Server). Nur `.rpc`, jede Antwort per zod geprüft.
 *
 * Fehlerpolitik (wirft nie):
 * - `42501` (kein Recht `manageLifecycle`, Papierkorb) → `forbidden`;
 * - kein Code (Netz, Abbruch) oder keine Antwort innerhalb der Zeitgrenze → `noAnswer`: ob der Abschluss gilt, ist offen –
 *   erneut senden nur mit DERSELBEN `request_id` (@LZ-021);
 * - jeder andere Server-Fehler oder eine Antwort außerhalb des Schemas → `unexpected`.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { FinalStandingsSnapshot } from '../standings/finalStandings/types';
import { parseStoredLifecycle, type TournamentLifecycle, type TournamentMatchState } from '../services/lifecycle';
import { withCloudReadTimeout } from './cloudAdoption';

type Client = SupabaseClient<Database> | null;
type RpcError = { code?: string; message: string };
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;

/** @LZ-021: höchstens 15 Sekunden auf die Antwort des Abschlusses warten. */
export const FINISH_TIMEOUT_MS = 15000;

// --- Offene Punkte und Warnungen (B-33-Übergabe) -------------------------------------------------------------------

const optionalInt = z.number().int().optional();
const MatchItemSchema = z.object({
  kind: z.enum(['match_running', 'match_undecided']),
  matchId: z.string(), matchNumber: optionalInt, field: optionalInt, finalType: z.string().optional(), groupId: z.string().optional(),
});
const GroupItemSchema = z.object({ kind: z.enum(['group_open', 'group_stale']), groupId: z.string() });
const TieItemSchema = z.object({
  kind: z.literal('tie_open'), groupId: z.string(), places: z.array(z.number().int()), teamIds: z.array(z.string()),
});
const NoticeItemSchema = z.object({ kind: z.literal('notice_open'), noticeId: z.number().int(), matchId: z.string(), side: z.string() });
const ClarificationItemSchema = z.object({
  kind: z.literal('clarification_open'), clarificationId: z.number().int(), matchId: z.string().optional(), groupId: z.string().optional(),
});
const ServerItemSchema = z.discriminatedUnion('kind', [MatchItemSchema, GroupItemSchema, TieItemSchema, NoticeItemSchema, ClarificationItemSchema]);

/** Offener Punkt vom Server; eine unbekannte Art hält den Abschluss trotzdem auf (`unknown`, nichts verschwindet still). */
export type ServerFinishItem = z.infer<typeof ServerItemSchema> | { kind: 'unknown'; serverKind: string };

/** Plan R3 E5: offener Eintrag der Klärungsliste (aus `list_match_reviews`, bis W-M nur in der App geprüft). */
export interface ReviewOpenItem {
  kind: 'review_open';
  eventId: string;
  matchId: string;
  matchNumber?: number;
  field?: number;
}

export type FinishItem = ServerFinishItem | ReviewOpenItem;

const WarningSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('outbox_pending'), field: optionalInt, pending: z.number().int(), reportedAt: z.string(), deviceId: z.string() }),
  z.object({
    kind: z.literal('device_silent'), field: z.number().int(), deviceId: z.string(), deviceLabel: z.string().optional(), since: z.string().optional(),
  }),
]);
/** Warnung vor dem Abschluss (sperrt nie, @LZ-018, @FU-068). */
export type FinishWarning = z.infer<typeof WarningSchema>;

function parseItems(raw: unknown[]): ServerFinishItem[] {
  return raw.map((item): ServerFinishItem => {
    const parsed = ServerItemSchema.safeParse(item);
    if (parsed.success) {
      return parsed.data;
    }
    const kind = (item as { kind?: unknown } | null)?.kind;
    return { kind: 'unknown', serverKind: typeof kind === 'string' ? kind : '' };
  });
}

/** Eine unlesbare Warnung fällt weg (Warnungen sperren nie). */
function parseWarnings(raw: unknown[]): FinishWarning[] {
  return raw.flatMap((item) => {
    const parsed = WarningSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const StateRowSchema = z.object({
  id: z.string(), ta: z.string().optional(), tb: z.string().optional(), a: optionalInt, b: optionalInt, oa: optionalInt, ob: optionalInt,
  pa: optionalInt, pb: optionalInt, s: z.string(), f: z.string().optional(),
});

const LifecycleSchema = z.enum(['draft', 'fixed', 'running', 'finished', 'cancelled']);

const PreflightSchema = z.object({
  status: z.literal('ok'),
  lifecycle: LifecycleSchema,
  finishedAt: z.string().nullable(),
  canFinish: z.boolean(),
  items: z.array(z.unknown()),
  warnings: z.array(z.unknown()),
  state: z.array(StateRowSchema),
});

export interface FinishPreflight {
  lifecycle: TournamentLifecycle;
  finishedAt: string | null;
  canFinish: boolean;
  items: ServerFinishItem[];
  warnings: FinishWarning[];
  /** Bestätigter Serverstand (`match_engine.tournament_state`) – genau das geht als `p_expected_state` zurück. */
  state: TournamentMatchState[];
}

export type FinishPreflightResult = { status: 'ok'; preflight: FinishPreflight } | { status: 'forbidden' } | { status: 'failed' };

function rpcOf(client: NonNullable<Client>): UntypedRpc {
  return client.rpc.bind(client) as unknown as UntypedRpc;
}

/** `finish_preflight(p_tournament_id)`: liest nur, sperrt nichts. */
export async function readFinishPreflight(client: Client, tournamentId: string): Promise<FinishPreflightResult> {
  if (!client) {
    return { status: 'failed' };
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(rpcOf(client)('finish_preflight', { p_tournament_id: tournamentId })));
    if (response.error) {
      return response.error.code === '42501' ? { status: 'forbidden' } : { status: 'failed' };
    }
    const parsed = PreflightSchema.safeParse(response.data);
    if (!parsed.success) {
      return { status: 'failed' };
    }
    const { lifecycle, finishedAt, canFinish, items, warnings, state } = parsed.data;
    return { status: 'ok', preflight: { lifecycle, finishedAt, canFinish, items: parseItems(items), warnings: parseWarnings(warnings), state } };
  } catch {
    return { status: 'failed' };
  }
}

// --- Abschluss ----------------------------------------------------------------------------------------------------

export const INVALID_STANDINGS_REASONS = ['SHAPE', 'TEAM_SET', 'PLACE_NUMBERS', 'GROUP_ORDER', 'GROUP_PLACES', 'PLACEMENT_GAME', 'PROVISIONAL'] as const;
export type InvalidStandingsReason = typeof INVALID_STANDINGS_REASONS[number];

const FinishResponseSchema = z.union([
  z.object({ status: z.literal('ok'), finishedAt: z.string(), alreadyApplied: z.literal(true).optional() }),
  z.object({ status: z.literal('rejected'), code: z.enum(['INVALID_INPUT', 'REQUEST_ID_CONFLICT', 'STALE_STATE']) }),
  z.object({
    status: z.literal('rejected'), code: z.literal('ALREADY_FINISHED'),
    by: z.string().nullish(), byUserId: z.string().nullish(), at: z.string().nullish(),
  }),
  z.object({ status: z.literal('rejected'), code: z.literal('NOT_RUNNING'), lifecycle: z.string().nullish() }),
  z.object({ status: z.literal('rejected'), code: z.literal('OPEN_ITEMS'), items: z.array(z.unknown()) }),
  z.object({ status: z.literal('rejected'), code: z.literal('INVALID_STANDINGS'), reason: z.enum(INVALID_STANDINGS_REASONS) }),
]);

export type FinishTournamentResult =
  | { status: 'ok'; finishedAt: string; alreadyApplied: boolean }
  | { status: 'rejected'; code: 'INVALID_INPUT' | 'REQUEST_ID_CONFLICT' | 'STALE_STATE' }
  | { status: 'rejected'; code: 'ALREADY_FINISHED'; by: string | null; at: string | null }
  | { status: 'rejected'; code: 'NOT_RUNNING'; lifecycle: string | null }
  | { status: 'rejected'; code: 'OPEN_ITEMS'; items: ServerFinishItem[] }
  | { status: 'rejected'; code: 'INVALID_STANDINGS'; reason: InvalidStandingsReason }
  | { status: 'forbidden' }
  | { status: 'noAnswer' }
  | { status: 'unexpected' };

export interface FinishTournamentRequest {
  tournamentId: string;
  /** Bestätigter Serverstand aus `finish_preflight` (E4), nie der optimistische Stand des Geräts. */
  expectedState: readonly TournamentMatchState[];
  snapshot: FinalStandingsSnapshot;
  /** Eine je Bestätigungsversuch; dieselbe beim erneuten Senden nach ausgebliebener Antwort (@LZ-021, E3). */
  requestId: string;
}

function mapFinishResponse(data: z.infer<typeof FinishResponseSchema>): FinishTournamentResult {
  if (data.status === 'ok') {
    return { status: 'ok', finishedAt: data.finishedAt, alreadyApplied: data.alreadyApplied === true };
  }
  switch (data.code) {
    case 'ALREADY_FINISHED':
      return { status: 'rejected', code: data.code, by: data.by ?? null, at: data.at ?? null };
    case 'NOT_RUNNING':
      return { status: 'rejected', code: data.code, lifecycle: data.lifecycle ?? null };
    case 'OPEN_ITEMS':
      return { status: 'rejected', code: data.code, items: parseItems(data.items) };
    case 'INVALID_STANDINGS':
      return { status: 'rejected', code: data.code, reason: data.reason };
    default:
      return { status: 'rejected', code: data.code };
  }
}

/** `finish_tournament(...)` mit Zeitgrenze (Standard 15 s): ausgebliebene Antwort = `noAnswer`, nie ein zweiter Versuch hier. */
export async function callFinishTournament(
  client: Client,
  request: FinishTournamentRequest,
  { timeoutMs = FINISH_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<FinishTournamentResult> {
  if (!client) {
    return { status: 'unexpected' };
  }
  const call = Promise.resolve(rpcOf(client)('finish_tournament', {
    p_tournament_id: request.tournamentId,
    p_expected_state: request.expectedState.map((row) => ({ ...row })),
    p_final_standings: request.snapshot,
    p_request_id: request.requestId,
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const response = await Promise.race([call, timeout]);
    if (response === 'timeout') {
      return { status: 'noAnswer' };
    }
    if (response.error) {
      const code = response.error.code ?? '';
      return code === '42501' ? { status: 'forbidden' } : code === '' ? { status: 'noAnswer' } : { status: 'unexpected' };
    }
    const parsed = FinishResponseSchema.safeParse(response.data);
    return parsed.success ? mapFinishResponse(parsed.data) : { status: 'unexpected' };
  } catch {
    return { status: 'noAnswer' };
  } finally {
    clearTimeout(timer);
  }
}

// --- Zustand vom Server ------------------------------------------------------------------------------------------

/**
 * `tournament_lifecycle(p_tournament_id)` (INVOKER): der Zustand, wie der Server ihn jetzt sieht. `null` = der Server kennt
 * das Turnier für dieses Konto nicht; `undefined` = keine Antwort (Netz, Fehler).
 */
export async function readTournamentLifecycle(client: Client, tournamentId: string): Promise<TournamentLifecycle | null | undefined> {
  if (!client) {
    return undefined;
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(rpcOf(client)('tournament_lifecycle', { p_tournament_id: tournamentId })));
    if (response.error) {
      return undefined;
    }
    if (response.data === null) {
      return null;
    }
    return response.data === 'running' ? 'running' : parseStoredLifecycle(response.data);
  } catch {
    return undefined;
  }
}
