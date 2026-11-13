/**
 * Steht die Leibchen-Karte (Leibchen nötig) oder ihre Zeile (Wahl getroffen) im Bild? Nur dann weicht die Tafel (@SL-240, @SL-241). Der kleine Knopf „Leibchen festlegen“
 * (kein Leibchen nötig, nichts gewählt) zählt nicht: dort bleibt die Tafel wie sie war.
 */
import type { LeibchenKarteDaten } from '../hooks/useLeibchenKarte';

export function leibchenKarteSteht(daten: Pick<LeibchenKarteDaten, 'gewaehlt' | 'nurFestlegen'> | null): boolean {
  if (daten === null) { return false; }
  return daten.gewaehlt !== null || !daten.nurFestlegen;
}
