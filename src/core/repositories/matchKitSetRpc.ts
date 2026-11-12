/**
 * Client der Leibchen-Wahl für `public.match_kit_set` (`20261124_002_leibchen_schritt2.sql`, Leibchen 2b Punkt 3): bestätigen („bib“), „Keine Leibchen“
 * („none“) und – im laufenden Spiel – Nachtragen, Entfernen, Seite wechseln (@SL-150). Muster `fieldControlRpc.ts`: nur `.rpc`, Antwort per zod geprüft.
 *
 * Fehlerpolitik: nie ein Wurf. Ergebnisart `saved`; `rejected` mit Code (die fachliche Abweisung des Servers: das Gerät nimmt die Wahl zurück und sagt es,
 * @SL-229); `offline` (Netz/Zeitlimit: die Wahl wartet und geht später raus, @SL-216); `forbidden` (42501), `invalid` (22023),
 * `tournamentFinished` (55000, R3-2a) und `error` werden nicht wiederholt.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { isTournamentFinishedRejection, isTransientMutationError } from '../errors';
import { normalizeKitColor, type KitDecision, type KitSide } from '../models/kit';
import { isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';

type Client = SupabaseClient<Database> | null;

export interface MatchKitSetArgs {
  matchId: string;
  decision: KitDecision;
  /** Nur bei `bib`: Seite und Leibchenfarbe. */
  bibSide?: KitSide | undefined;
  bibColor?: string | undefined;
  /** Die Teams, die das Gerät beim Wählen auf den Seiten sah; stehen inzwischen andere da, weist der Server ab (TEAMS_CHANGED, @SL-229). */
  teams?: { a: string; b: string } | undefined;
  deviceId?: string | undefined;
  controlEpoch?: number | null | undefined;
}

const REJECTION_CODES = ['NOT_CONTROLLER', 'LEAD_ONLY', 'NOT_NEXT_MATCH', 'MATCH_FINISHED', 'MATCH_SKIPPED', 'TEAMS_CHANGED'] as const;
export type MatchKitRejectionCode = (typeof REJECTION_CODES)[number];

const ResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), phase: z.enum(['before', 'live']), decision: z.enum(['bib', 'none']), kit: z.unknown().optional() }),
  z.object({ status: z.literal('rejected'), code: z.enum(REJECTION_CODES), detail: z.looseObject({ reason: z.string().optional() }).nullish() }),
]);

export type MatchKitSetResult =
  | { kind: 'saved'; phase: 'before' | 'live'; decision: KitDecision }
  | { kind: 'rejected'; code: MatchKitRejectionCode; reason?: string }
  | { kind: 'offline' }
  | { kind: 'forbidden' }
  | { kind: 'invalid' }
  | { kind: 'tournamentFinished' }
  | { kind: 'error'; message: string };

function kitArgument(args: MatchKitSetArgs): Record<string, string> {
  return {
    ...(args.decision === 'bib' ? { bibSide: args.bibSide ?? '', bibColor: normalizeKitColor(args.bibColor) ?? args.bibColor ?? '' } : {}),
    ...(args.teams === undefined ? {} : { teamA: args.teams.a, teamB: args.teams.b }),
  };
}

/** Schreibt die Wahl; wirft nie. */
export async function sendMatchKitSet(client: Client, args: MatchKitSetArgs): Promise<MatchKitSetResult> {
  if (!client) {
    return { kind: 'offline' };
  }
  try {
    const kit = kitArgument(args);
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('match_kit_set', {
      p_match_id: args.matchId,
      p_decision: args.decision,
      ...(Object.keys(kit).length === 0 ? {} : { p_kit: kit }),
      ...(args.deviceId === undefined ? {} : { p_device_id: args.deviceId }),
      ...(args.controlEpoch === undefined || args.controlEpoch === null ? {} : { p_control_epoch: args.controlEpoch }),
    })));
    if (response.error) {
      return classifyError(response.error);
    }
    const parsed = ResponseSchema.safeParse(response.data);
    if (!parsed.success) {
      return { kind: 'error', message: 'Unerwartete Antwort von match_kit_set' };
    }
    const body = parsed.data;
    if (body.status === 'saved') {
      return { kind: 'saved', phase: body.phase, decision: body.decision };
    }
    const reason = body.detail?.reason;
    return { kind: 'rejected', code: body.code, ...(reason === undefined ? {} : { reason }) };
  } catch (error) {
    return classifyError(error);
  }
}

function classifyError(error: unknown): MatchKitSetResult {
  if (isTournamentFinishedRejection(error)) {
    return { kind: 'tournamentFinished' };
  }
  if (isCloudReadTimeout(error) || isTransientMutationError(error)) {
    return { kind: 'offline' };
  }
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (code === '42501') {
    return { kind: 'forbidden' };
  }
  if (code === '22023') {
    return { kind: 'invalid' };
  }
  return { kind: 'error', message: error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error) };
}
