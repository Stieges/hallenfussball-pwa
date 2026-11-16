/**
 * hallAbmelden – die Turnierleitung meldet den Hallen-Lautsprecher eines Felds ab (H4-11b, @HT-057). Ruft `hall_speaker_unassign` (nur Felder, nie eine
 * Geräte-Kennung: der Client kennt die Kennung eines fremden Geräts nicht und braucht sie nicht) und liest danach den Stand sofort neu, damit die Karte
 * gleich „kein Hallen-Lautsprecher“ zeigt (@HT-016), ohne auf den nächsten Takt zu warten. Das abgemeldete Gerät erfährt es mit seinem nächsten
 * Lebenszeichen (`unassigned`, Marke „abgemeldet“). Nichts wirft; der Fehlergrund kommt als Ergebnis zurück.
 */
import { hallSpeakerUnassign, type HallErgebnis, type HallUnassignAntwort } from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import { hallStatusNeuLesen } from './useHallStatus';

export async function meldeLautsprecherAb(turnierId: string, feld: number): Promise<HallErgebnis<HallUnassignAntwort>> {
  const ergebnis = await hallSpeakerUnassign(supabase, { p_tournament_id: turnierId, p_fields: [feld] });
  if (ergebnis.ok) {
    hallStatusNeuLesen(turnierId);
  }
  return ergebnis;
}
