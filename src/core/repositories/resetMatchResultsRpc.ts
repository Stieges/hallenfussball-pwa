/**
 * Typisierter Client für `reset_match_results` (A-10, `supabase/migrations/20261028_005_guard_all_matches.sql`).
 * Muster `appendMatchEventsRpc.ts`: ruft nur `.rpc`, nie `.from`; Antwort per zod geprüft.
 *
 * Der Server setzt Ergebnisse von Spielen OHNE Einträge zurück (nur Turnierleitung, alles oder nichts). Hat eines der
 * Spiele Einträge, ändert er nichts und meldet `HAS_ENTRIES` mit den betroffenen Spielen (Server-Zwilling von @FU-090).
 * `42501` (kein Recht, Papierkorb) ist kein Fehler, sondern das Ergebnis `forbidden`; alles andere wirft
 * `RepositoryError` (auch „Funktion fehlt“ vor dem Einspielen, PGRST202/42883).
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { RepositoryError } from '../errors';

const ResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), reset: z.number().int() }),
  z.object({ status: z.literal('rejected'), code: z.literal('HAS_ENTRIES'), matchIds: z.array(z.string()) }),
]);

export type ResetMatchResultsResult = z.infer<typeof ResponseSchema> | { status: 'forbidden' };

/** `src/types/supabase.ts` kennt die Funktion erst nach dem Typen-PR (nach F2b) – deshalb ohne Typbindung. */
type UntypedRpc = (
  fn: 'reset_match_results',
  args: { p_tournament_id: string; p_match_ids: string[] },
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

export async function callResetMatchResults(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  matchIds: readonly string[],
): Promise<ResetMatchResultsResult> {
  const operation = 'resetMatchResults';
  if (!client) {
    throw new RepositoryError(operation, 'Supabase ist nicht konfiguriert');
  }
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
  let response: Awaited<ReturnType<UntypedRpc>>;
  try {
    response = await rpc('reset_match_results', { p_tournament_id: tournamentId, p_match_ids: [...matchIds] });
  } catch (error) {
    throw new RepositoryError(operation, 'Zurücksetzen nicht übertragen', error);
  }
  if (response.error) {
    if (response.error.code === '42501') {
      return { status: 'forbidden' };
    }
    throw new RepositoryError(operation, response.error.message, response.error);
  }
  const parsed = ResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new RepositoryError(operation, 'Unerwartete Antwort von reset_match_results', parsed.error);
  }
  return parsed.data;
}
