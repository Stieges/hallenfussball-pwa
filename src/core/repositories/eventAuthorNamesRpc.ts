/**
 * Lesepfad der Urheber-Namen (UR, Befund C-EREIGNIS-OHNE-URHEBER, `supabase/migrations/20261028_006_event_author_names.sql`).
 * Muster `resetMatchResultsRpc.ts`: ruft nur `.rpc`, nie `.from`; Antwort per zod geprüft.
 *
 * Der Server liefert je Engine-Eintrag eines Spiels Name und Rolle des Urhebers -- nur für Turnierleitung und Helfer
 * (@FU-065), sonst 0 Zeilen. Fehlerpolitik (brief-UR.md § 10): Netz, Zeitlimit, fehlendes Recht → leere Map ohne
 * Meldung; Unerwartetes (z. B. Funktion fehlt vor F2b, `PGRST202`/`42883`) → leere Map + eine Meldung je Sitzung.
 * Szenarien: @FU-080, @FU-082, @FU-065.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { captureFeatureError } from '../../lib/sentry';
import { isCloudReadTimeout, withCloudReadTimeout } from './cloudAdoption';

export interface EventAuthor {
  name: string | null;
  role: string | null;
}

/**
 * Zwilling Z1 der SQL-Regel in `match_event_author_names`: Eigentümer → Profilname; Mitglied → Name aus der
 * Einladung (`label`), sonst Profilname; leer/Leerzeichen → `null`. Nie die E-Mail.
 */
export function authorNameRule(input: { isOwner: boolean; label?: string | null; displayName?: string | null }): string | null {
  const clean = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  };
  if (input.isOwner) {
    return clean(input.displayName);
  }
  return clean(input.label) ?? clean(input.displayName);
}

// Zeilentyp von Hand, bis der Typen-PR nach F2b `src/types/supabase.ts` erneuert (wie `matchKitRow.ts`).
const RowsSchema = z.array(z.object({
  event_id: z.string(),
  author_name: z.string().nullable(),
  author_role: z.string().nullable(),
}));

type UntypedRpc = (
  fn: 'match_event_author_names',
  args: { p_match_id: string },
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

const EMPTY: ReadonlyMap<string, EventAuthor> = new Map();
let reported = false;

/** Nur für Tests: die „einmal je Sitzung“-Sperre der Meldung zurücksetzen. */
export function resetEventAuthorNamesReporting(): void {
  reported = false;
}

function reportOnce(error: Error, matchId: string): void {
  if (reported) {
    return;
  }
  reported = true;
  captureFeatureError(error, 'sync', 'readEventAuthorNames', { matchId });
}

/** Erwartbar: kein Code (Netz/Transport) oder 42501 (kein EXECUTE, z. B. ohne Anmeldung). */
const isExpectedError = (code: string | undefined): boolean => !code || code === '42501';

export async function readEventAuthorNames(
  client: SupabaseClient<Database> | null,
  matchId: string,
): Promise<ReadonlyMap<string, EventAuthor>> {
  if (!client) {
    return EMPTY;
  }
  const rpc = client.rpc.bind(client) as unknown as UntypedRpc;
  let response: Awaited<ReturnType<UntypedRpc>>;
  try {
    response = await withCloudReadTimeout(Promise.resolve(rpc('match_event_author_names', { p_match_id: matchId })));
  } catch (error) {
    if (!isCloudReadTimeout(error) && !(error instanceof TypeError) && error instanceof Error) {
      reportOnce(error, matchId);
    }
    return EMPTY;
  }
  if (response.error) {
    if (!isExpectedError(response.error.code)) {
      reportOnce(new Error(`match_event_author_names: ${response.error.code} ${response.error.message}`), matchId);
    }
    return EMPTY;
  }
  const parsed = RowsSchema.safeParse(response.data);
  if (!parsed.success) {
    reportOnce(new Error('match_event_author_names: unerwartete Antwort'), matchId);
    return EMPTY;
  }
  return new Map(parsed.data.map((row) => [row.event_id, { name: row.author_name, role: row.author_role }]));
}
