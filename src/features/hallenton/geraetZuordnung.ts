/**
 * Zuordnung dieses Geräts, die über „Schalter ein, Felder wählen“ hinausgeht (H4-9):
 * - `wechsleTurnier` (@HT-056): ein Gerät dient höchstens einem Turnier. Erst die Zuordnung im NEUEN Turnier, dann die Abmeldung im
 *   alten; lokal stoppt die Laufzeit und die Einschaltung wandert. Scheitert die Zuordnung (belegt, kein Recht, kein Netz), bleibt
 *   alles wie vorher. Die Abmeldung des alten Turniers wird vor dem Aufruf gemerkt (`ausstehendeAbmeldung.ts`) und bleibt auch ohne
 *   Netz erhalten: der Baustein holt sie nach, bis dahin zeigt das alte Turnier „meldet sich nicht“, danach „kein Hallen-Lautsprecher“.
 * - `meldeFeldAb`: ein einzelnes Feld abwählen (der letzte Chip schaltet das Gerät ganz aus, das macht der Aufrufer über `ausschalten`).
 * Beides wirkt lokal sofort, bevor der Server gefragt wird (Netz kann hängen, W3).
 */
import { getDeviceId } from '../../core/device/deviceId';
import {
  hallSpeakerAssign, hallSpeakerRelease, type HallAssignAntwort, type HallErgebnis, type HallFehlerGrund, type HallReleaseAntwort,
} from '../../core/repositories/hallentonRpc';
import { supabase } from '../../lib/supabase';
import { merkeAbmeldung, vergissAbmeldung, vergissAbmeldungWenn } from './ausstehendeAbmeldung';
import { abgeloestVerstanden, geraetStand, setzeEinschaltung, setzeLebenszeichenFehler } from './lautsprecherGeraet';

export interface WechselEingabe {
  /** Das neue Turnier. */
  tid: string;
  felder: readonly number[];
  name: string;
  /** Nach der Rückfrage „Ablösen?“ (@HT-015) des neuen Turniers. */
  abloesen?: boolean;
}

/**
 * Antwort der Zuordnung im neuen Turnier. `alteAbmeldungFehler`: die Abmeldung im alten Turnier ist an etwas anderem als dem Netz gescheitert
 * (z. B. dort kein Recht mehr, Turnier beendet) und wird nicht wiederholt – dort steht dann ein verwaister Lautsprecher, die Oberfläche sagt es.
 * Am Netz gescheitert heißt: der Baustein holt sie nach, kein Hinweis nötig.
 */
export type WechselErgebnis = HallErgebnis<HallAssignAntwort> & { alteAbmeldungFehler?: HallFehlerGrund };

/** `null`: dieses Gerät ist in keinem anderen Turnier Lautsprecher (nichts zu wechseln). Sonst die Antwort der Zuordnung im neuen Turnier. */
export async function wechsleTurnier({ tid, felder, name, abloesen = false }: WechselEingabe): Promise<WechselErgebnis | null> {
  const alt = geraetStand().einschaltung;
  if (alt === null || alt.turnierId === tid) {
    return null;
  }
  const ergebnis = await hallSpeakerAssign(supabase, {
    p_tournament_id: tid, p_fields: [...felder], p_device_id: getDeviceId(), p_device_name: name, p_replace: abloesen,
  });
  if (!ergebnis.ok || ergebnis.status !== 'assigned') {
    return ergebnis; // belegt (Rückfrage „Ablösen?“) oder Fehler: nichts hat sich geändert
  }
  const aktuell = geraetStand().einschaltung ?? alt; // ein anderer Tab kann inzwischen etwas geändert haben
  const abmeldung = { turnierId: aktuell.turnierId, felder: [...aktuell.felder] };
  abgeloestVerstanden();
  setzeLebenszeichenFehler(null);
  vergissAbmeldung(); // eine ältere offene Abmeldung ist überholt; die des alten Turniers wird gleich neu gemerkt
  if (abmeldung.turnierId !== tid) {
    merkeAbmeldung(abmeldung);
  }
  geraetStand().laufzeit?.stop(); // kein Ton mehr für das alte Turnier, auch bevor der Baustein die Laufzeit abräumt
  setzeEinschaltung({ turnierId: tid, felder: ergebnis.fields, name });
  if (abmeldung.turnierId !== tid) {
    const abgemeldet = await hallSpeakerRelease(supabase, { p_tournament_id: abmeldung.turnierId, p_fields: abmeldung.felder, p_device_id: getDeviceId() });
    if (abgemeldet.ok || abgemeldet.grund !== 'netz') {
      vergissAbmeldungWenn(abmeldung);
    }
    if (!abgemeldet.ok && abgemeldet.grund !== 'netz') {
      return { ...ergebnis, alteAbmeldungFehler: abgemeldet.grund };
    }
  }
  return ergebnis;
}

/** Ein Feld abwählen, die übrigen bleiben. `null`, wenn dieses Gerät das Feld in `tid` nicht hat. Nichts wirft. */
export async function meldeFeldAb(tid: string, feld: number): Promise<HallErgebnis<HallReleaseAntwort> | null> {
  const aktuell = geraetStand().einschaltung;
  if (aktuell?.turnierId !== tid || !aktuell.felder.includes(feld)) {
    return null;
  }
  const abmeldung = { turnierId: tid, felder: [feld] };
  merkeAbmeldung(abmeldung);
  setzeEinschaltung({ ...aktuell, felder: aktuell.felder.filter((f) => f !== feld) });
  const ergebnis = await hallSpeakerRelease(supabase, { p_tournament_id: tid, p_fields: abmeldung.felder, p_device_id: getDeviceId() });
  if (ergebnis.ok || ergebnis.grund !== 'netz') {
    vergissAbmeldungWenn(abmeldung);
  }
  return ergebnis;
}
