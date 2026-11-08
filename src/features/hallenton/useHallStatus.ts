/**
 * useHallStatus(tid) – Stand der Hallen-Lautsprecher für Verwaltung, Kopfzeile und Cockpit (H3b-3, Datenseite für H4; @HT-011,
 * @HT-014, @HT-016, @HT-039, @HT-041, @HT-042, @HT-047, @HT-049). `hall_sound_status` alle 5 s, nur solange der Hook eingebunden
 * ist; volle Sicht mit `manageScreens`, sonst die schmale Sicht (`hallStatusAbfrage.ts`).
 *
 * - `stand`: `laedt` (erste Antwort aussteht), `aktuell`, `unbekannt` (@HT-041: ohne eigenes Netz nie ein alter Stand),
 *   `kein_recht`.
 * - `felder[N]`: Lage je Feld mit Lautsprecher (`hallStatusAuswertung.ts`); Felder ohne fehlen (neutral).
 * - `testtonAnfordern(feld)` (@HT-017): ohne aktuellen Stand kein Aufruf, Ergebnis `netz` („Kein Testton: kein Netz“).
 * - `gehoert(feld)` (@HT-049): „✓ Gehört“ nimmt den Hinweis „🔈? Prüfen“ weg (`hall_output_heard`).
 * Keine Oberfläche.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { getDeviceId } from '../../core/device/deviceId';
import {
  hallOutputHeard, hallSoundStatus, hallTestToneRequest,
  type HallErgebnis, type HallHeardAntwort, type HallTestRequestAntwort,
} from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import { erzeugeHallStatusAbfrage, type HallStatusSchnappschuss } from './runtime/hallStatusAbfrage';
import { echterZeitgeber } from './runtime/zeitgeber';

export interface HallStatus extends HallStatusSchnappschuss {
  testtonAnfordern(feld: number): Promise<HallErgebnis<HallTestRequestAntwort>>;
  gehoert(feld: number): Promise<HallErgebnis<HallHeardAntwort>>;
}

const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

export function useHallStatus(tid: string): HallStatus {
  const abfrage = useMemo(() => erzeugeHallStatusAbfrage({
    turnierId: tid,
    deviceId: getDeviceId(),
    rpc: (args) => hallSoundStatus(supabase, args),
    online,
    zeitgeber: echterZeitgeber,
  }), [tid]);

  useEffect(() => {
    abfrage.start();
    window.addEventListener('online', abfrage.abfragen);
    window.addEventListener('offline', abfrage.abfragen);
    return () => {
      window.removeEventListener('online', abfrage.abfragen);
      window.removeEventListener('offline', abfrage.abfragen);
      abfrage.stop();
    };
  }, [abfrage]);

  const stand = useSyncExternalStore(abfrage.subscribe, abfrage.getSnapshot, abfrage.getSnapshot);

  const testtonAnfordern = useCallback(async (feld: number): Promise<HallErgebnis<HallTestRequestAntwort>> => {
    if (abfrage.getSnapshot().stand !== 'aktuell') {
      return { ok: false, grund: 'netz' };
    }
    const ergebnis = await hallTestToneRequest(supabase, { p_tournament_id: tid, p_field: feld });
    abfrage.abfragen();
    return ergebnis;
  }, [abfrage, tid]);

  const gehoert = useCallback(async (feld: number): Promise<HallErgebnis<HallHeardAntwort>> => {
    const ergebnis = await hallOutputHeard(supabase, { p_tournament_id: tid, p_field: feld });
    abfrage.abfragen();
    return ergebnis;
  }, [abfrage, tid]);

  return useMemo(() => ({ ...stand, testtonAnfordern, gehoert }), [stand, testtonAnfordern, gehoert]);
}
