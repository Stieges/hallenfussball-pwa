/**
 * Effektiver Spielstand = reguläre Tore + Verlängerungstore.
 * MatchExecutionService.recordGoal schreibt in overtime/goldenGoal ausschließlich overtimeScoreA/B
 * und lässt homeScore/awayScore unangetastet. Jede Anzeige des AKTUELLEN Stands muss beides addieren.
 * Elfmeter zählen NICHT hinein: penaltyScoreA/B stehen als eigenes Ergebnis daneben (decidedBy).
 */
export interface ScoredMatch {
  homeScore: number;
  awayScore: number;
  overtimeScoreA?: number;
  overtimeScoreB?: number;
}

export function getEffectiveScore(match: ScoredMatch): { home: number; away: number } {
  return {
    home: match.homeScore + (match.overtimeScoreA ?? 0),
    away: match.awayScore + (match.overtimeScoreB ?? 0),
  };
}
