/**
 * Adapter (b) der Zuschauer-Seite: die Server-Funktion `public_tournament(share_code, since_version)` (B-14, B-15).
 *
 * Antwortet der Server mit „nichts geändert“ (wenige Byte) oder nur mit den Änderungen, spart das Egress gegenüber dem
 * Voll-Abruf. Die Serverzeit jeder Antwort gleicht die Uhr des Handys ab (@ZM-026). Der Adapter ist hinter dem Schalter
 * `PUBLIC_TOURNAMENT_RPC` (`config/featureFlags.ts`); die Funktion existiert erst nach dem Datenbank-Fenster von B-14.
 * Getestet wird er gegen einen Stub des Vertrags (`publicTournamentWire.ts`).
 */
import { supabase } from '../../lib/supabase';
import { PUBLIC_POLL_INTERVAL_MS, type PublicFetchResult, type PublicTournamentSource } from './publicSource';
import { parsePublicReply } from './publicTournamentWire';
import { ObservedServerClock } from './serverClock';

export interface PublicRpcArgs {
  share_code: string;
  since_version: number | null;
}

export interface PublicRpcResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export type PublicRpcCall = (args: PublicRpcArgs) => Promise<PublicRpcResponse>;

/** Aufruf über den Supabase-Client; die generierten Typen kennen die Funktion noch nicht (B-14). */
const supabaseCall: PublicRpcCall = async (args) => {
  if (supabase === null) {
    return { data: null, error: { message: 'supabase not configured' } };
  }
  const client = supabase as unknown as { rpc: (name: string, params: PublicRpcArgs) => PromiseLike<PublicRpcResponse> };
  return client.rpc('public_tournament', args);
};

export interface RpcPublicSourceOptions {
  call?: PublicRpcCall;
  clock?: ObservedServerClock;
  pollIntervalMs?: number;
  /** Geräteuhr (nur für Tests) */
  deviceNow?: () => number;
}

/** Eine ganze Zahl als `since_version`; alles andere (Stand eines anderen Adapters) heißt „noch nichts“. */
function sinceOf(sinceVersion: string | null): number | null {
  if (sinceVersion === null) {
    return null;
  }
  const parsed = Number(sinceVersion);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function createRpcPublicSource(options: RpcPublicSourceOptions = {}): PublicTournamentSource {
  const call = options.call ?? supabaseCall;
  const deviceNow = options.deviceNow ?? ((): number => Date.now());
  const clock = options.clock ?? new ObservedServerClock(deviceNow);

  return {
    kind: 'rpc',
    pollIntervalMs: options.pollIntervalMs ?? PUBLIC_POLL_INTERVAL_MS,
    nowMs: () => clock.nowMs(),
    async fetch(shareCode: string, sinceVersion: string | null): Promise<PublicFetchResult> {
      const requestedAt = deviceNow();
      try {
        const response = await call({ share_code: shareCode, since_version: sinceOf(sinceVersion) });
        if (response.error !== null) {
          return { kind: 'unreachable' };
        }
        const parsed = parsePublicReply(response.data);
        if (parsed.serverNowMs !== undefined) {
          clock.observe(parsed.serverNowMs, requestedAt, deviceNow());
        }
        return parsed.result;
      } catch {
        return { kind: 'unreachable' };
      }
    },
  };
}
