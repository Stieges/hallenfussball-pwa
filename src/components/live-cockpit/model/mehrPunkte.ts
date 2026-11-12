/**
 * mehrPunkteGrundgeruest – welche Punkte das Blatt „Mehr“ im Zustand anbietet (Plan LT-1, Grundgerüst).
 * Rein, ohne React. „Seiten tauschen“ und „Uhr korrigieren“ kommen aus `darfImZustand` (eine Quelle, K11): Die Uhr nur im Spiel
 * und nur mit Steuerrecht (@SL-079), Seiten tauschen auch lesend (nur die eigene Anzeige, @SL-065) und nicht in
 * `wartetAufHerkunft`. „Einstellungen“ stehen in jedem Zustand da (ohne Steuerrecht gesperrt sichtbar, Spec § 4.4).
 * Halbzeit, Fortsetzen und Helfer-Anfragen ergänzt Altplan 3.7 später auf dieser Funktion.
 */
import type { CockpitPhase } from './cockpitPhase';
import { darfImZustand } from './darf';

export type MehrPunkt = 'uhrKorrigieren' | 'seitenTauschen' | 'einstellungen' | 'nichtAngetreten' | 'leibchenNachtragen';

/** Zustände mit angepfiffenem, noch nicht beendetem Spiel: dort trägt nur die Turnierleitung Leibchen nach (@SL-150). */
const IM_SPIEL: ReadonlySet<CockpitPhase['zustand']> = new Set(['laeuft', 'pausiert', 'halbzeitpause', 'pauseVorVerlaengerung', 'entscheidung', 'strafstoss']);

/** Welche Punkte „Mehr“ im Zustand anbietet (ohne Rücksicht darauf, ob der Aufrufer eine Aktion liefert). */
/**
 * B-12 (@SL-174, @SL-175): „Nicht angetreten“ nur für die Turnierleitung (`istLeitung`, nie für Helfer, auch nicht mit Steuerrecht)
 * und nur vor dem Anpfiff.
 */
export function mehrPunkteGrundgeruest(phase: CockpitPhase, k: { kannSteuern: boolean; istLeitung?: boolean; leibchenNachtragen?: boolean }): MehrPunkt[] {
  const punkte: MehrPunkt[] = [];
  if (darfImZustand(phase.zustand, k.kannSteuern, 'uhrKorrigieren')) { punkte.push('uhrKorrigieren'); }
  if (darfImZustand(phase.zustand, k.kannSteuern, 'seitenTauschen')) { punkte.push('seitenTauschen'); }
  if (k.istLeitung === true && darfImZustand(phase.zustand, true, 'nichtAngetreten')) { punkte.push('nichtAngetreten'); }
  // @SL-150: Leibchen nachtragen, entfernen oder die Seite wechseln – im laufenden Spiel nur Turnierleitung und Co-Admin, nie der Helfer
  if (k.leibchenNachtragen === true && IM_SPIEL.has(phase.zustand)) { punkte.push('leibchenNachtragen'); }
  punkte.push('einstellungen');
  return punkte;
}
