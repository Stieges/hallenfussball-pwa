/**
 * Regel 3 für das Cockpit (H3b-3, @HT-009, @HT-033 Zeilen 2, 7, 9, 10, 11): Auf dem Lautsprecher-Gerät schweigt der Cockpit-Ton
 * für seine Felder – aber nur, solange der Lautsprecher dieses Geräts für das Feld **bereit** ist (Meldung des tönenden Tabs im
 * Kanal, höchstens 2 s alt, `lautsprecherKanal.ts`) **und** die Halle den Ton nach Regel 2 spielen darf: die letzte Antwort des
 * Servers für das Feld ist beim Ton-Anlass höchstens 5 s alt, dieselbe Grenze wie die Freigabe vor dem Ton (K3 aus H3b-3). Ist
 * er nicht bereit, ist die Antwort älter, fehlt die Meldung oder ist sie veraltet, tönt das Cockpit wie eingestellt (im Zweifel
 * tönt das Cockpit, sonst gäbe es gar keinen Ton).
 *
 * Gelesen wird bei jedem Ton-Anlass neu (aus `localStorage`, das alle Tabs teilen) – das ist frischer als ein Stand, der auf
 * Nachrichten im `BroadcastChannel('hallenton')` wartet, und eine veraltete Meldung bedeutet sofort wieder Cockpit-Ton.
 */
import { ANTWORT_MAX_ALTER_MS, cockpitTonSchweigt } from '../../core/hallenton';
import { feldKennung } from './runtime/aktuellesSpielJeFeld';
import { browserKanalSpeicher, leseLautsprecherFelder, type KanalSpeicher, type LautsprecherMeldung } from './runtime/lautsprecherKanal';

/** Felder (`field-N`), für die die Halle jetzt tönt: bereit und Antwort am Server zu `serverNow` höchstens 5 s alt. */
export function hallTontFeldIds(meldung: LautsprecherMeldung | null, turnierId: string, serverNow: number): string[] {
  if (meldung?.turnierId !== turnierId) {
    return [];
  }
  return (meldung?.felder ?? [])
    .filter((f) => f.bereit && typeof f.antwortAt === 'number' && serverNow - f.antwortAt <= ANTWORT_MAX_ALTER_MS)
    .map((f) => feldKennung(f.feld));
}

export function cockpitTonSchweigtJetzt(
  turnierId: string,
  feldId: string | null | undefined,
  serverNow: number,
  speicher: KanalSpeicher | null = browserKanalSpeicher(),
  jetzt: number = Date.now(),
): boolean {
  if (!feldId) {
    return false;
  }
  return cockpitTonSchweigt(feldId, hallTontFeldIds(leseLautsprecherFelder(speicher, jetzt), turnierId, serverNow));
}
