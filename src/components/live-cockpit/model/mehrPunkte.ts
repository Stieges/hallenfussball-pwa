/**
 * mehrPunkteGrundgeruest – welche Punkte das Blatt „Mehr“ im Zustand anbietet (Plan LT-1, Grundgerüst).
 * Rein, ohne React. Halbzeit, Fortsetzen und Helfer-Anfragen ergänzt Altplan 3.7 später auf dieser Funktion.
 */
import type { CockpitPhase } from './cockpitPhase';

export type MehrPunkt = 'uhrKorrigieren' | 'seitenTauschen' | 'einstellungen';

/** Welche Punkte „Mehr“ im Zustand anbietet (ohne Rücksicht darauf, ob der Aufrufer eine Aktion liefert). */
export function mehrPunkteGrundgeruest(phase: CockpitPhase, k: { kannSteuern: boolean }): MehrPunkt[] {
  const imSpiel = phase.zustand === 'laeuft' || phase.zustand === 'pausiert';
  const punkte: MehrPunkt[] = [];
  if (k.kannSteuern && imSpiel) { punkte.push('uhrKorrigieren'); }
  if (phase.zustand !== 'keinSpiel') { punkte.push('seitenTauschen'); }
  punkte.push('einstellungen');
  return punkte;
}
