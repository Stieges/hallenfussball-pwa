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

/**
 * Wer ein Feld gerade steuert, aus Sicht dieses Geräts: Name (Profil bzw. Einladung, nie die E-Mail) und Geräte-Kennung,
 * wie `field_control_state` sie liefert. Den Anzeigetext baut der Aufrufer mit `fieldHolderText` (B-49).
 */
export interface FieldHolder {
  field: number;
  holderName: string | null;
  holderDeviceLabel: string | null;
}

/**
 * Halter des Feldes `field`, wenn ein ANDERES Gerät es steuert; `null`, wenn es frei ist, dieses Gerät es steuert oder
 * der Stand nicht lesbar ist. `deviceId` (`getDeviceId()`) ist Pflicht: ohne sie meldet der Server nie `isMine`, das
 * steuernde Gerät sähe sich selbst als fremden Halter (B-49).
 */
export async function readForeignFieldHolder(
  client: SupabaseClient<Database> | null,
  tournamentId: string,
  field: number,
  deviceId: string,
): Promise<FieldHolder | null> {
  if (!client) {
    return null;
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('field_control_state', {
      p_tournament_id: tournamentId,
      p_device_id: deviceId,
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
    return { field, holderName: row.holderName, holderDeviceLabel: row.holderDeviceLabel };
  } catch {
    return null;
  }
}
