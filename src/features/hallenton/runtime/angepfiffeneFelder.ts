/**
 * Welche Felder haben ein angepfiffenes Spiel (H4-5 Fixrunde 1, @HT-035 letzte Zeile)? Rein: aus dem Spielplan (lokale Kopie) und dem
 * Status je Spiel nach der Engine des Geräts, sonst nach der Kopie – dieselbe Regel wie das Lebenszeichen der Leitung
 * (`leitungGeraet.ts`). „Handy ohne Netz“ gilt nur für diese Felder: nach Spielende meldet das leitende Gerät nichts mehr, das ist kein Ausfall.
 */
import type { MatchState } from '../../../core/match';
import { istAngepfiffen, type PlanSpiel } from './feldStandSpiele';

export function angepfiffeneFelder(plan: readonly PlanSpiel[], statusJeSpiel: (spielId: string) => MatchState['status'] | undefined): ReadonlySet<number> {
  return new Set(laufendeSpiele(plan, statusJeSpiel).keys());
}

/** Feld → Nummer des angepfiffenen Spiels (H4-10: „Auf Feld 1 läuft Spiel 11“, @HT-017); läuft auf einem Feld mehr als eines, zählt das erste im Plan. */
export function laufendeSpiele(plan: readonly PlanSpiel[], statusJeSpiel: (spielId: string) => MatchState['status'] | undefined): ReadonlyMap<number, number> {
  const spiele = new Map<number, number>();
  for (const spiel of plan) {
    if (istAngepfiffen(statusJeSpiel(spiel.id) ?? spiel.status) && !spiele.has(spiel.field)) {
      spiele.set(spiel.field, spiel.matchNumber);
    }
  }
  return spiele;
}
