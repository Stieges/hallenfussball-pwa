/**
 * Der Ausgang dieses Tabs mit den Bausteinen des Browsers (H4-6): Liste (`mediaDevices`), Wahl (`localStorage`, `storage`) und
 * Wächter – je Tab genau einer, damit Spieler und Hook (`useHallAusgang`) dieselbe Lage sehen. Erst beim ersten Bedarf erzeugt;
 * ohne gespeicherte Wahl liest und ruft er nichts auf.
 */
import { browserKanalSpeicher } from '../lautsprecherKanal';
import { erzeugeBrowserAusgangListe, type AusgangListeQuelle } from './ausgangListe';
import { erzeugeAusgangWaechter, type AusgangWaechter } from './ausgangWaechter';
import { erzeugeAusgangWahl, type AusgangWahl } from './ausgangWahl';

export interface BrowserAusgang {
  liste: AusgangListeQuelle;
  wahl: AusgangWahl;
  waechter: AusgangWaechter;
}

let ausgang: BrowserAusgang | null = null;

export function browserAusgang(): BrowserAusgang {
  if (!ausgang) {
    const liste = erzeugeBrowserAusgangListe();
    const wahl = erzeugeAusgangWahl({ speicher: browserKanalSpeicher(), seite: typeof window === 'undefined' ? null : window });
    ausgang = { liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl }) };
  }
  return ausgang;
}

/**
 * Kann dieser Browser einen Ausgang wählen? `AudioContext.setSinkId` und `mediaDevices` müssen da sein (nicht in Safari und
 * Firefox, nicht außerhalb einer sicheren Herkunft): sonst „Standard“ ohne Wahl (@HT-053, letzte Zeile).
 */
export function ausgangWaehlbar(): boolean {
  return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype && browserAusgang().liste.verfuegbar();
}

/** Nur für Tests. */
export function __setzeAusgangFuerTests(neu: BrowserAusgang | null = null): void {
  ausgang?.waechter.beenden();
  ausgang = neu;
}
