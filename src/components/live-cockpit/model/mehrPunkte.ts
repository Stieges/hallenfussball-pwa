/**
 * mehrPunkteGrundgeruest – welche Punkte das Blatt „Mehr“ im Zustand anbietet (Plan LT-1, Grundgerüst).
 * Rein, ohne React. „Seiten tauschen“ und „Uhr korrigieren“ kommen aus `darfImZustand` (eine Quelle, K11): Die Uhr nur im Spiel
 * und nur mit Steuerrecht (@SL-079), Seiten tauschen auch lesend (nur die eigene Anzeige, @SL-065) und nicht in
 * `wartetAufHerkunft`. „Einstellungen“ stehen in jedem Zustand da (ohne Steuerrecht gesperrt sichtbar, Spec § 4.4).
 * Halbzeit, Fortsetzen und Helfer-Anfragen ergänzt Altplan 3.7 später auf dieser Funktion.
 */
import type { CockpitPhase } from './cockpitPhase';
import { darfImZustand } from './darf';

export type MehrPunkt = 'uhrKorrigieren' | 'seitenTauschen' | 'einstellungen' | 'nichtAngetreten';

/** Welche Punkte „Mehr“ im Zustand anbietet (ohne Rücksicht darauf, ob der Aufrufer eine Aktion liefert). */
/**
 * B-12 (@SL-174, @SL-175): „Nicht angetreten“ nur für die Turnierleitung (`istLeitung`, nie für Helfer, auch nicht mit Steuerrecht)
 * und nur vor dem Anpfiff.
 */
export function mehrPunkteGrundgeruest(phase: CockpitPhase, k: { kannSteuern: boolean; istLeitung?: boolean }): MehrPunkt[] {
  const punkte: MehrPunkt[] = [];
  if (darfImZustand(phase.zustand, k.kannSteuern, 'uhrKorrigieren')) { punkte.push('uhrKorrigieren'); }
  if (darfImZustand(phase.zustand, k.kannSteuern, 'seitenTauschen')) { punkte.push('seitenTauschen'); }
  if (k.istLeitung === true && darfImZustand(phase.zustand, true, 'nichtAngetreten')) { punkte.push('nichtAngetreten'); }
  punkte.push('einstellungen');
  return punkte;
}
