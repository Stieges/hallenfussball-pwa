/**
 * vorwarnungAktiv – ab wann die Zeile „Nächstes“ aufruft (Plan LT-3, K12, @SL-155, @SL-156).
 * Rein, ohne React: im letzten regulären Abschnitt, Uhr läuft oder steht, Restzeit des ganzen Spiels höchstens 3:00.
 * Die Restzeit rechnet `restzeitSpielMs` (dieselbe Rechnung wie die Rückfrage beim Abpfiff); „letzter Abschnitt“ liest `CockpitPhase`
 * (aus `PhaseView.isLastRegularSection`), wird hier nicht neu gerechnet.
 */
import type { CockpitPhase } from './cockpitPhase';

/** @SL-155 „Restzeit 3:00“ */
export const VORWARNUNG_MS = 180_000;

export function vorwarnungAktiv(phase: CockpitPhase, restSpielMs: number | null): boolean {
  if (restSpielMs === null) { return false; }
  if (phase.zustand !== 'laeuft' && phase.zustand !== 'pausiert') { return false; }
  if (phase.abschnittArt !== 'regulaer' || !phase.letzterAbschnitt) { return false; }
  return restSpielMs <= VORWARNUNG_MS;
}
