/**
 * Typisierter Client für den Server-Schreibweg (B3b): `append_match_events` und `server_time`
 * (supabase/migrations/20260928_003_append_match_events.sql).
 *
 * Noch NIRGENDS aufgerufen -- die App schreibt bis PR C über den alten Weg. Die Antwort der RPC
 * wird zur Laufzeit per zod geprüft (die generierten Typen kennen nur `Json`); jede Abweichung und
 * jeder Transportfehler wird zu einem `RepositoryError`. `CLIENT_OUTDATED` ist KEIN Fehler, sondern
 * ein eigenes Ergebnis -- der Aufrufer (C) muss dann die App aktualisieren lassen.
 *
 * @see .superpowers/sdd/2026-09-25-pr-b-schreibweg/task-B3b-brief.md Abschnitt 2
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../types/supabase';
import { RepositoryError } from '../errors';
import {
  DecidedBySchema,
  MatchStatusSchema,
  PhaseSchema,
  type EngineEvent,
  type ServerMatchState,
} from '../match';

/** Ein Ereignis, wie das Gerät es sendet. `actor` bestimmt der Server aus der Rolle (R7). */
export type AppendableEvent = Omit<EngineEvent, 'actor' | 'actorUser'> & {
  /** Steuerungs-Epoche (R16), vom Server erst ab E geprüft. */
  controlEpoch?: number | null;
  /** Stand, auf dem das Gerät das Ereignis erzeugt hat (landet in match_event_authors). */
  baseState?: Json;
};

export interface AppendOptions {
  /** Format der App (muss >= app_config.min_client_format sein, sonst CLIENT_OUTDATED). */
  clientFormat: number;
  /** Geräte-ID (uuid), landet in match_event_authors.device_id. */
  deviceId?: string;
}

// Ergebnisarten R10 -- `review` gibt es erst ab F, der Client kennt sie schon.
const AppendEventResultSchema = z.object({
  id: z.string().nullable(),
  status: z.enum(['accepted', 'duplicate', 'noop', 'rejected', 'review']),
  code: z.string().optional(),
  detail: z.unknown().optional(),
  seq: z.number().int().optional(),
});
export type AppendEventResult = z.infer<typeof AppendEventResultSchema>;

// Form von toServerState (src/core/match/serverState.ts, Ruling P2).
const ServerMatchStateSchema = z.object({
  status: MatchStatusSchema,
  phase: PhaseSchema,
  section: z.number(),
  clock: z.object({ running: z.boolean(), elapsedMs: z.number(), anchorAt: z.number().nullable() }),
  scores: z.record(z.string(), z.object({ regular: z.number(), overtime: z.number(), shootout: z.number() })),
  effectiveScores: z.record(z.string(), z.number()),
  shootoutKicks: z.array(z.object({ id: z.string(), teamId: z.string(), scored: z.boolean() })),
  lastScoreEventId: z.string().nullable(),
  decidedBy: DecidedBySchema.nullable(),
  finishedAt: z.number().nullable(),
});

const AppendAcceptedResponseSchema = z.object({
  results: z.array(AppendEventResultSchema),
  // null, wenn der Aufrufer für dieses Turnier kein Schreibrecht hat (alle FORBIDDEN_ACTOR).
  state: ServerMatchStateSchema.nullable(),
  serverTime: z.number(),
});

const ClientOutdatedResponseSchema = z.object({
  error: z.literal('CLIENT_OUTDATED'),
  minClientFormat: z.number().int(),
  serverTime: z.number(),
});

export interface AppendSuccess {
  results: AppendEventResult[];
  state: ServerMatchState | null;
  serverTime: number;
}
export type AppendClientOutdated = z.infer<typeof ClientOutdatedResponseSchema>;
export type AppendResult = AppendSuccess | AppendClientOutdated;

export function isClientOutdated(result: AppendResult): result is AppendClientOutdated {
  return 'error' in result && result.error === 'CLIENT_OUTDATED';
}

const ServerTimeResponseSchema = z.object({ serverTime: z.number() });

type Client = SupabaseClient<Database>;

function requireClient(client: Client | null, operation: string): Client {
  if (!client) {
    throw new RepositoryError(operation, 'Supabase ist nicht konfiguriert');
  }
  return client;
}

/** Ruft `append_match_events` für GENAU ein Spiel auf (R12) und prüft die Antwort. */
export async function callAppendMatchEvents(
  client: Client | null,
  matchId: string,
  events: readonly AppendableEvent[],
  options: AppendOptions
): Promise<AppendResult> {
  const operation = 'appendMatchEvents';
  const supabaseClient = requireClient(client, operation);

  let data: unknown;
  try {
    const response = await supabaseClient.rpc('append_match_events', {
      p_match_id: matchId,
      p_events: events as unknown as Json,
      p_client_format: options.clientFormat,
      ...(options.deviceId !== undefined ? { p_device_id: options.deviceId } : {}),
    });
    if (response.error) {
      throw new RepositoryError(operation, response.error.message, response.error);
    }
    data = response.data;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(operation, 'Übertragung der Ereignisse fehlgeschlagen', error);
  }

  const outdated = ClientOutdatedResponseSchema.safeParse(data);
  if (outdated.success) {
    return outdated.data;
  }
  const accepted = AppendAcceptedResponseSchema.safeParse(data);
  if (!accepted.success) {
    throw new RepositoryError(operation, 'Unerwartete Antwort von append_match_events', accepted.error);
  }
  return accepted.data;
}

/** Serverzeit in Epoch-ms (`server_time`, auch ohne Anmeldung), Grundlage für den Uhr-Offset. */
export async function callServerTime(client: Client | null): Promise<number> {
  const operation = 'serverTime';
  const supabaseClient = requireClient(client, operation);

  let data: unknown;
  try {
    const response = await supabaseClient.rpc('server_time');
    if (response.error) {
      throw new RepositoryError(operation, response.error.message, response.error);
    }
    data = response.data;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    throw new RepositoryError(operation, 'Serverzeit nicht erreichbar', error);
  }
  const parsed = ServerTimeResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new RepositoryError(operation, 'Unerwartete Antwort von server_time', parsed.error);
  }
  return parsed.data.serverTime;
}
