/**
 * Ausschalten ohne Netz (H3b-3, Restpunkt aus H3b-2b, @HT-038): `ausschalten()` stoppt den Lautsprecher lokal sofort. Scheitert
 * `hall_speaker_release` am Netz, merkt sich das Gerät die Abmeldung (`hallenton:abmelden`) und holt sie nach – beim Start der
 * App, wenn das Netz zurückkommt (`online`) und alle 30 s, solange sie offen ist. Bis dahin sieht die Verwaltung
 * „meldet sich nicht“, danach „kein Hallen-Lautsprecher“.
 *
 * Ein neues Einschalten verwirft eine offene Abmeldung (sonst nähme sie die neue Zuordnung wieder weg). Die Abmeldung trifft
 * am Server nur Felder dieses Geräts; hat inzwischen ein anderes Gerät übernommen, ändert sie nichts. Ein Fehler außer dem
 * Netz (z. B. kein Recht mehr) beendet sie ohne Wiederholung. Nichts wirft.
 */
import { getDeviceId } from '../../core/device/deviceId';
import { hallSpeakerRelease } from '../../core/repositories/hallentonRpc';
import { browserKanalSpeicher } from './runtime/lautsprecherKanal';
import { lies, schreib } from './runtime/tonEinstellungen';

export const ABMELDEN_SCHLUESSEL = 'hallenton:abmelden';
export const ABMELDEN_NEU_MS = 30_000;

type Client = Parameters<typeof hallSpeakerRelease>[0];

export interface AusstehendeAbmeldung {
  turnierId: string;
  felder: number[];
}

let laeuft = false;

export function ausstehendeAbmeldung(): AusstehendeAbmeldung | null {
  try {
    const roh: unknown = JSON.parse(lies(browserKanalSpeicher(), ABMELDEN_SCHLUESSEL) ?? 'null');
    if (!roh || typeof roh !== 'object') {
      return null;
    }
    const { turnierId, felder } = roh as { turnierId?: unknown; felder?: unknown };
    return typeof turnierId === 'string' && Array.isArray(felder) && felder.length > 0 && felder.every((f) => Number.isInteger(f))
      ? { turnierId, felder: felder as number[] }
      : null;
  } catch {
    return null;
  }
}

export function merkeAbmeldung(abmeldung: AusstehendeAbmeldung): void {
  schreib(browserKanalSpeicher(), ABMELDEN_SCHLUESSEL, JSON.stringify(abmeldung));
}

export function vergissAbmeldung(): void {
  try {
    browserKanalSpeicher()?.removeItem(ABMELDEN_SCHLUESSEL);
  } catch {
    // gesperrt: nichts gemerkt
  }
}

/** Holt eine offene Abmeldung nach; `true`, wenn danach keine mehr offen ist. */
export async function abmeldungNachholen(client: Client): Promise<boolean> {
  const offen = ausstehendeAbmeldung();
  if (offen === null) {
    return true;
  }
  if (laeuft) {
    return false;
  }
  laeuft = true;
  try {
    const ergebnis = await hallSpeakerRelease(client, { p_tournament_id: offen.turnierId, p_fields: offen.felder, p_device_id: getDeviceId() });
    if (!ergebnis.ok && ergebnis.grund === 'netz') {
      return false;
    }
    if (JSON.stringify(ausstehendeAbmeldung()) === JSON.stringify(offen)) {
      vergissAbmeldung(); // nur, wenn inzwischen nichts Neues gemerkt oder verworfen wurde
    }
    return true;
  } finally {
    laeuft = false;
  }
}
