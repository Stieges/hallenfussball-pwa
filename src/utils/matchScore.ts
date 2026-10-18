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

/** Was die Tafel vom Cockpit-Spiel liest (Tore, Verlängerung, Strafstoßschießen). */
export interface LiveResultMatch extends ScoredMatch {
  penaltyScoreA?: number;
  penaltyScoreB?: number;
}

export interface LiveFinalScore {
  /** Tore inkl. Verlängerung/Golden Goal, OHNE Strafstoßschießen (IFAB Regel 10). */
  a: number;
  b: number;
  /** Strafstoß-Ergebnis; die Engine füllt die Spalten nur, wenn geschossen wurde. */
  penalty?: { a: number; b: number };
}

/**
 * ÜBERGANG bis Cockpit 4.3 (wie `getEffectiveScore`): Endstand eines Cockpit-Spiels für die Tafel. Tore über `finalGoals`
 * (`core/view`), das Strafstoß-Ergebnis getrennt. Der Wächter `scoreWritePaths` erlaubt außerhalb der Liste kein Objekt mit
 * `scoreA`/`scoreB`; deshalb ruft dieser Übergang `matchFinalScore` nicht auf. Mit der Ansicht `MatchView.score` (A-36d, 4.3)
 * entfällt er.
 */
export function liveMatchFinalScore(match: LiveResultMatch): LiveFinalScore {
  const goals = finalGoals({ a: match.homeScore, b: match.awayScore }, match);
  return match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined
    ? { ...goals, penalty: { a: match.penaltyScoreA, b: match.penaltyScoreB } }
    : goals;
}
