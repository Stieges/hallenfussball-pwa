/**
 * Regel 3 für das Cockpit (H3b-3, @HT-009, @HT-033 Zeilen 2, 7, 9, 10): Auf dem Lautsprecher-Gerät schweigt der Cockpit-Ton für
 * seine Felder – aber nur, solange der Lautsprecher dieses Geräts für das Feld **bereit** ist (Meldung des tönenden Tabs im
 * Kanal, höchstens 2 s alt, `lautsprecherKanal.ts`). Ist er nicht bereit, fehlt die Meldung oder ist sie veraltet, tönt das
 * Cockpit wie eingestellt (im Zweifel tönt das Cockpit, sonst gäbe es gar keinen Ton).
 *
 * Gelesen wird bei jedem Ton-Anlass neu (aus `localStorage`, das alle Tabs teilen) – das ist frischer als ein Stand, der auf
 * Nachrichten im `BroadcastChannel('hallenton')` wartet, und eine veraltete Meldung bedeutet sofort wieder Cockpit-Ton.
 */
import { cockpitTonSchweigt } from '../../core/hallenton';
import { bereiteLautsprecherFeldIds, browserKanalSpeicher, leseLautsprecherFelder, type KanalSpeicher } from './runtime/lautsprecherKanal';

export function cockpitTonSchweigtJetzt(
  turnierId: string,
  feldId: string | null | undefined,
  speicher: KanalSpeicher | null = browserKanalSpeicher(),
  jetzt: number = Date.now(),
): boolean {
  if (!feldId) {
    return false;
  }
  return cockpitTonSchweigt(feldId, bereiteLautsprecherFeldIds(leseLautsprecherFelder(speicher, jetzt), turnierId));
}
