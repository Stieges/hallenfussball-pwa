/**
 * Hilfen der Spielplan-Tests (A-36c): baut die gemeinsame Ansicht (`buildTournamentView`) aus Spielen des Spielplans
 * und dem Zwischenspeicher, wie ihn der Server liefert (Status, Stand, Verlängerung, Strafstoß, Entscheidung).
 */
import { buildTournamentView, type TournamentView, type ViewAudience } from '../../../core/view';
import type { ScheduledMatch } from '../../../core/generators';
import { createMockTournament } from '../../../test/factories';
import type { Match, Team, Tournament } from '../../../types/tournament';

/** Zwischenspeicher-Spalten eines Spiels (Status, Stand, Entscheidung). */
export type Cache = Partial<Pick<
  Match,
  'matchStatus' | 'scoreA' | 'scoreB' | 'overtimeScoreA' | 'overtimeScoreB' | 'penaltyScoreA' | 'penaltyScoreB'
  | 'decidedBy' | 'timerStartTime' | 'timerElapsedSeconds'
>>;

/** Das Spiel des Turniers zu einem Spielplan-Eintrag, mit dem Zwischenspeicher darüber. */
export function matchOf(scheduled: ScheduledMatch, cache: Cache = {}): Match {
  return {
    id: scheduled.id,
    round: 1,
    field: scheduled.field,
    slotA: scheduled.slotA,
    slotB: scheduled.slotB,
    ...(scheduled.originA === undefined ? {} : { originA: scheduled.originA }),
    ...(scheduled.originB === undefined ? {} : { originB: scheduled.originB }),
    group: scheduled.group,
    isFinal: scheduled.isFinal,
    label: scheduled.label,
    matchNumber: scheduled.matchNumber,
    phase: scheduled.phase,
    ...cache,
  };
}

export function viewOf(
  matches: readonly Match[],
  teams: readonly Team[],
  options: { audience?: ViewAudience; tournament?: Partial<Tournament> } = {},
): TournamentView {
  const tournament = createMockTournament({ teams: [...teams], matches: [...matches], ...options.tournament });
  return buildTournamentView(tournament, { audience: options.audience ?? 'organizer', medium: 'app', locale: 'de' });
}
