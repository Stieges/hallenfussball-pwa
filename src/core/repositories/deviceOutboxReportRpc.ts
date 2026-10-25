/**
 * Client für `report_device_outbox(p_tournament_id, p_device_id, p_field, p_pending)` (Migration 20261113_003, A-21a-C3; R3-2a,
 * @LZ-018, @FU-068): die Zahl wartender Einträge dieses Geräts. Recht `writeMatchData`, bleibt nach dem Abschluss erlaubt, sperrt
 * nie etwas. Wirft nie: Netz, Zeitlimit, fehlendes Recht oder fehlender Client → `false` (der nächste Takt meldet erneut).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { withCloudReadTimeout } from './cloudAdoption';
import type { OutboxReport } from '../fieldControl/outboxReport';

type Client = SupabaseClient<Database> | null;
type Args = Database['public']['Functions']['report_device_outbox']['Args'];

/** `true`, wenn der Server die Meldung angenommen hat. */
export async function reportDeviceOutbox(client: Client, deviceId: string, report: OutboxReport): Promise<boolean> {
  if (!client) {
    return false;
  }
  // Der erzeugte Typ führt jedes Argument als Pflichtwert; die Server-Funktion nimmt für ein unbekanntes Feld NULL an
  // (20261113_003: `p_field IS NOT NULL AND p_field NOT BETWEEN 1 AND 99` ist der einzige Ausschluss).
  const args = { p_tournament_id: report.tournamentId, p_device_id: deviceId, p_field: report.field, p_pending: report.pending } as unknown as Args;
  try {
    const response = await withCloudReadTimeout(Promise.resolve(client.rpc('report_device_outbox', args)));
    return !response.error;
  } catch {
    return false;
  }
}
