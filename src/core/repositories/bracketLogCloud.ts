/**
 * Lesepfad des Verlaufs der Besetzung und der Gleichstands-Entscheidungen (GA4 A-13b-C, `bracket_log_read` aus Migration
 * `20261110_006`). Muster `eventAuthorNamesRpc.ts`: nur `.rpc`, nie `.from` (`bracket_log` hat kein Tabellenrecht), Antwort
 * per zod geprüft. Nur die Turnierleitung bekommt Zeilen (@TM-113, @W2A-071, @W2A-072), Name nie die E-Mail.
 *
 * Fehlerpolitik: Der Verlauf ist Zusatzwissen (wer, wann) und darf das Laden des Turniers nie verhindern.
 * Netz, Zeitlimit, fehlendes Recht (`42501`, z. B. ohne Anmeldung) → `undefined`, keine Meldung; Unerwartetes (etwa die
 * Funktion fehlt vor dem Einspielen, `PGRST202`/`42883`) → `undefined` + eine Meldung je Sitzung.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { BracketLogEntry, BracketLogKind } from '../../types/tournament';
import { captureFeatureError } from '../../lib/sentry';
import { isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';

const KINDS = [
  'complete_group', 'reopen_group', 'standing_decision', 'standing_withdraw', 'auto_advance', 'auto_reassign', 'release',
  'set_slot', 'swap_sides', 'set_advancement', 'set_slot_source', 'notice_kept', 'clarification_resolved',
] as const satisfies readonly BracketLogKind[];

const RowSchema = z.object({
  id: z.coerce.number().int(),
  kind: z.enum(KINDS),
  match_id: z.string().nullable(),
  group_id: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
  actor_name: z.string().nullable(),
  actor_role: z.string().nullable(),
  created_at: z.string(),
});

export type BracketLogRow = z.infer<typeof RowSchema>;

/** Zeile von `bracket_log_read` → Eintrag am Turnier (`null` heißt fehlend). */
export function mapBracketLogRow(row: BracketLogRow): BracketLogEntry {
  return {
    id: row.id,
    kind: row.kind,
    ...(row.match_id !== null ? { matchId: row.match_id } : {}),
    ...(row.group_id !== null ? { groupId: row.group_id } : {}),
    detail: row.detail ?? {},
    ...(row.reason !== null ? { reason: row.reason } : {}),
    ...(row.actor_name !== null ? { actorName: row.actor_name } : {}),
    ...(row.actor_role !== null ? { actorRole: row.actor_role } : {}),
    at: row.created_at,
  };
}

type UntypedRpc = (
  fn: 'bracket_log_read',
  args: { p_tournament_id: string },
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

let reported = false;

/** Nur für Tests: die „einmal je Sitzung“-Sperre der Meldung zurücksetzen. */
export function resetBracketLogReporting(): void {
  reported = false;
}

function reportOnce(error: Error, tournamentId: string): void {
  if (reported) {
    return;
  }
  reported = true;
  captureFeatureError(error, 'sync', 'readBracketLog', { tournamentId });
}

/** Erwartbar: kein Code (Netz/Transport) oder 42501 (kein EXECUTE, z. B. ohne Anmeldung). */
const isExpectedError = (code: string | undefined): boolean => !code || code === '42501';

/** Der Verlauf in Reihenfolge der Einträge oder `undefined`, wenn er nicht gelesen werden konnte. Ohne Recht: leere Liste. */
export async function readBracketLog(client: SupabaseClient<Database> | null, tournamentId: string): Promise<BracketLogEntry[] | undefined> {
  if (!client) {
    return undefined;
  }
  let response: Awaited<ReturnType<UntypedRpc>>;
  try {
    const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
    response = await withCloudReadTimeout(Promise.resolve(rpc('bracket_log_read', { p_tournament_id: tournamentId })));
  } catch (error) {
    if (!isCloudReadTimeout(error) && !(error instanceof TypeError) && error instanceof Error) {
      reportOnce(error, tournamentId);
    }
    return undefined;
  }
  if (response.error) {
    if (!isExpectedError(response.error.code)) {
      reportOnce(new Error(`bracket_log_read: ${response.error.code ?? ''} ${response.error.message}`), tournamentId);
    }
    return undefined;
  }
  const parsed = z.array(RowSchema).safeParse(response.data);
  if (!parsed.success) {
    reportOnce(new Error('bracket_log_read: unerwartete Antwort'), tournamentId);
    return undefined;
  }
  return parsed.data.map(mapBracketLogRow);
}
