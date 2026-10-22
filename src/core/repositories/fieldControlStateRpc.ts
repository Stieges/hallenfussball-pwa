/**
 * Kleiner Lesepfad für die Steuer je Feld (`public.field_control_state`, 20261110_003 A-34) -- nur für den Hinweis
 * „Feld 2 wird gerade von Tom gesteuert“ vor dem Beenden im Spielplan (@FU-115, @FU-081). Der volle Leser mit Abo kommt
 * mit B-49; bis dahin genügt eine einmalige Abfrage. Muster `eventAuthorNamesRpc.ts`: nur `.rpc`, Antwort per zod geprüft.
 *
 * Fehlerpolitik: ohne Client, Netz, Recht oder bei unerwarteter Antwort → `null` (kein Hinweis, der Weg bleibt offen --
 * der Server entscheidet ohnehin selbst). Namen wie `match_event_author_names`, nie die E-Mail.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { withCloudReadTimeout } from './cloudAdoption';

const FieldsSchema = z.array(z.object({
  field: z.number(),
  holderName: z.string().nullable(),
  holderRole: z.string().nullable(),
  holderDeviceLabel: z.string().nullable(),
  isMine: z.boolean(),
}));

/** Wer ein Feld gerade steuert, aus Sicht dieses Geräts. */
export interface FieldHolder {
  field: number;
  /** Name (Profil bzw. Einladung) und Gerät, z. B. „Tom (Handy)“; `null`, wenn beides fehlt. */
  holder: string | null;
}

/** Name und Gerät des Halters: „Tom (Handy)“, nur Name, nur Gerät oder `null`. */
export function holderText(name: string | null, deviceLabel: string | null): string | null {
  const clean = (value: string | null): string | null => (value?.trim() ? value.trim() : null);
  const n = clean(name);
  const d = clean(deviceLabel);
  if (n && d) {
    return `${n} (${d})`;
  }
  return n ?? d;
}

/**
 * Halter des Feldes `field`, wenn ein ANDERES Gerät es steuert; `null`, wenn es frei ist, dieses Gerät es steuert oder
 * der Stand nicht lesbar ist.
 */
export async function readForeignFieldHolder(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  field: number,
  deviceId?: string,
): Promise<FieldHolder | null> {
  if (!client) {
    return null;
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('field_control_state', {
      p_tournament_id: tournamentId,
      ...(deviceId !== undefined ? { p_device_id: deviceId } : {}),
    })));
    if (response.error) {
      return null;
    }
    const parsed = FieldsSchema.safeParse(response.data);
    if (!parsed.success) {
      return null;
    }
    const row = parsed.data.find((entry) => entry.field === field);
    // frei: kein Halter (holderRole null); eigenes Gerät: kein Hinweis
    if (!row || row.isMine || row.holderRole === null) {
      return null;
    }
    return { field, holder: holderText(row.holderName, row.holderDeviceLabel) };
  } catch {
    return null;
  }
}
