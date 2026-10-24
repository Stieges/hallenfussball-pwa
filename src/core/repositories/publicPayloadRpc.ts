/**
 * Aufruf der öffentlichen Server-Funktionen (B-14, E-A2): `public_tournament(share_code, since_version)` für Zuschauer und
 * `display_tournament(tournament_id, monitor_id, since_version)` für den heutigen Monitor-Link (bis B-20/B-21).
 *
 * Fehler der Anfrage (Netz, Zeitüberschreitung, Serverfehler, Überlast) werfen `RepositoryError`, eine Antwort außerhalb des
 * Vertrags wirft `UnreadableResponseError` -- beides ist nie „nicht gefunden“ (@ZM-109). Die generierten Datenbank-Typen
 * kennen die Funktionen erst nach dem Datenbank-Fenster (Typen-PR auf main), deshalb der schmale Aufruf-Typ.
 */
import { RepositoryError, UnreadableResponseError } from '../errors';
import { parsePublicPayload, type PublicReply } from './publicPayload';

export interface RpcResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/** Was von einem Supabase-Client gebraucht wird (Tests reichen einen Stub). */
export interface RpcClient {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<RpcResponse>;
}

async function call(client: RpcClient, name: string, params: Record<string, unknown>): Promise<PublicReply> {
  const { data, error } = await client.rpc(name, params);
  if (error !== null) {
    throw new RepositoryError(name, error.message, error);
  }
  try {
    return parsePublicPayload(data);
  } catch (err) {
    throw new UnreadableResponseError(name, err);
  }
}

export function callPublicTournament(client: unknown, shareCode: string, sinceVersion: number | null): Promise<PublicReply> {
  return call(client as RpcClient, 'public_tournament', { share_code: shareCode, since_version: sinceVersion });
}

export function callDisplayTournament(
  client: unknown,
  tournamentId: string,
  monitorId: string,
  sinceVersion: number | null,
): Promise<PublicReply> {
  return call(client as RpcClient, 'display_tournament', {
    tournament_id: tournamentId,
    monitor_id: monitorId,
    since_version: sinceVersion,
  });
}
