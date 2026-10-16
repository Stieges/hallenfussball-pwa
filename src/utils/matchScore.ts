/**
 * ÜBERGANG bis Cockpit 4.3 (Brief A-36b, Auflage Cockpit): Der Endstand liegt zentral in
 * `core/view/finalScore.ts`. Diese Funktion ist nur noch die Cockpit-Form (`home`/`away`) darauf und wird nach
 * dem Cockpit-Neubau gelöscht. Tore = regulär + Verlängerung; das Strafstoßschießen zählt NICHT hinein.
 */
import { finalGoals } from '../core/view/finalScore';

export interface ScoredMatch {
  homeScore: number;
  awayScore: number;
  overtimeScoreA?: number;
  overtimeScoreB?: number;
}

export function getEffectiveScore(match: ScoredMatch): { home: number; away: number } {
  const goals = finalGoals({ a: match.homeScore, b: match.awayScore }, match);
  return { home: goals.a, away: goals.b };
}
