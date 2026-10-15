/**
 * Mischt den Turnierstand in den Plan (B-28a3-4, Punkt 2): Ergebnis, Status, Korrekturhistorie und Strafstoß-Ergebnis
 * aus `tournament.matches`. Vorher stand das Einmischen im Dialog `PDFExportDialog.tsx`; hier ist es testbar.
 */
import type { GeneratedSchedule, ScheduledMatch, SchedulePhase } from '../../core/generators';
import type { CorrectionEntry, MatchStatus, Tournament } from '../../types/tournament';

/** Plan-Spiel mit dem Turnierstand, den das PDF braucht. */
export interface StatefulMatch extends ScheduledMatch {
  matchStatus?: MatchStatus;
  correctionHistory?: CorrectionEntry[];
  penaltyScoreA?: number;
  penaltyScoreB?: number;
}

export type StatefulSchedule = GeneratedSchedule & {
  allMatches: StatefulMatch[];
  phases: Array<SchedulePhase & { matches: StatefulMatch[] }>;
};

/** Plan mit dem Stand des Turniers: Spiele werden über ihre ID zugeordnet. */
export function withTournamentState(schedule: GeneratedSchedule, tournament: Tournament): StatefulSchedule {
  const byId = new Map(tournament.matches.map(match => [match.id, match]));
  const merge = (sm: ScheduledMatch): StatefulMatch => {
    const tm = byId.get(sm.id);
    if (!tm) {
      return sm;
    }
    return {
      ...sm,
      scoreA: tm.scoreA,
      scoreB: tm.scoreB,
      matchStatus: tm.matchStatus,
      correctionHistory: tm.correctionHistory,
      penaltyScoreA: tm.penaltyScoreA,
      penaltyScoreB: tm.penaltyScoreB,
    };
  };
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(merge),
    phases: schedule.phases.map(phase => ({ ...phase, matches: phase.matches.map(merge) })),
  };
}
