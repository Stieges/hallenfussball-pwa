/**
 * Welche Felder haben ein angepfiffenes Spiel (H4-5 Fixrunde 1, @HT-035 letzte Zeile)? Rein: aus dem Spielplan (lokale Kopie) und dem
 * Status je Spiel nach der Engine des Geräts, sonst nach der Kopie – dieselbe Regel wie das Lebenszeichen der Leitung
 * (`leitungGeraet.ts`). „Handy ohne Netz“ gilt nur für diese Felder: nach Spielende meldet das leitende Gerät nichts mehr, das ist kein Ausfall.
 */
import type { MatchState } from '../../../core/match';
import { istAngepfiffen, type PlanSpiel } from './feldStandSpiele';

export function angepfiffeneFelder(plan: readonly PlanSpiel[], statusJeSpiel: (spielId: string) => MatchState['status'] | undefined): ReadonlySet<number> {
  const felder = new Set<number>();
  for (const spiel of plan) {
    if (istAngepfiffen(statusJeSpiel(spiel.id) ?? spiel.status)) {
      felder.add(spiel.field);
    }
  }
  return felder;
}
