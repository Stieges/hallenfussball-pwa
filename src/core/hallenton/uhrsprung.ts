/**
 * Uhrsprung erkennen: Die Geräteuhr (`Date.now`) kann springen (Zeitabgleich des Systems, Hand, Schlaf), die stetige Uhr
 * (`performance.now`) nicht. Weichen ihre Fortschritte um mehr als die Schwelle ab, muss das Gerät die Uhr neu mit dem
 * Server abgleichen und neu planen (@HT-010, @HT-004). Rein, ohne React; die Proben liefert der Aufrufer.
 */

/** Ab dieser Abweichung gilt es als Sprung: die Hälfte der erlaubten 1 s neben dem Cockpit (Ableitung). */
export const UHRSPRUNG_SCHWELLE_MS = 500;

export interface UhrProbe {
  /** `Date.now()` */
  wandMs: number;
  /** `performance.now()` */
  monoMs: number;
}

/** Sprung der Geräteuhr zwischen zwei Proben in ms (positiv = vor); `null`, wenn er nicht über der Schwelle liegt. */
export function uhrsprungMs(vorher: UhrProbe, jetzt: UhrProbe, schwelleMs: number = UHRSPRUNG_SCHWELLE_MS): number | null {
  const sprung = (jetzt.wandMs - vorher.wandMs) - (jetzt.monoMs - vorher.monoMs);
  return Math.abs(sprung) > schwelleMs ? sprung : null;
}
