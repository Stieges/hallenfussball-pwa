/**
 * Reihenfolge und Kürzung der Statuszeile (G6, @HT-045). Reine Funktionen, fachfrei: sie kennen nur `rang`, `reihe` und die Anzahl.
 */
import type { StatusEintrag, StatusRang } from './statusZeileTypen';

const RANG: Record<StatusRang, number> = { stoerung: 0, probe: 1, hinweis: 2, bereit: 3 };

/** Ab dieser Anzahl fallen die übrigen Einträge zu „+n weitere“ zusammen. */
export const MAX_OHNE_KUERZUNG = 2;

/** Störung → Probe → Hinweis → bereit, innerhalb des Rangs nach `reihe` (z. B. Feldnummer); gleiche Plätze behalten ihre Reihenfolge. */
export function sortiereEintraege(eintraege: ReadonlyArray<StatusEintrag>): StatusEintrag[] {
  return [...eintraege].sort((a, b) => RANG[a.rang] - RANG[b.rang] || (a.reihe ?? 0) - (b.reihe ?? 0));
}

/** Störung und Probe bleiben immer sichtbar. */
const bleibtSichtbar = (e: StatusEintrag): boolean => e.rang === 'stoerung' || e.rang === 'probe';

/**
 * Sichtbare Einträge und Zahl der zusammengefassten. Bis zu zwei Einträge zeigt die Zeile alle; bei mehr bleiben Störung und Probe,
 * alle übrigen werden gezählt. `aufgeklappt` zeigt alle.
 */
export function kuerzeEintraege(sortiert: ReadonlyArray<StatusEintrag>, aufgeklappt: boolean): { sichtbar: StatusEintrag[]; weitere: number } {
  if (sortiert.length <= MAX_OHNE_KUERZUNG) { return { sichtbar: [...sortiert], weitere: 0 }; }
  const weitere = sortiert.filter((e) => !bleibtSichtbar(e)).length;
  return { sichtbar: aufgeklappt ? [...sortiert] : sortiert.filter(bleibtSichtbar), weitere };
}
