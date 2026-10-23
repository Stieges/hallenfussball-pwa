/**
 * Platzierung/Endstand und Gruppenphase der Ansicht (A-36b, Teilplan A-36 § 2.4 „Platz/Endstand“).
 * - `final` nur bei edition ≠ blank ∧ closed ∧ Platzierung für jedes Team vollständig; sonst `open`.
 * - `groupRanks` nur bei rules.tables (@ZM-102, @BM-032).
 * - `groupPhaseOpen` = irgendein Gruppenspiel weder beendet/gewertet noch ausgefallen.
 */
import type { MatchView, PlacementView, TournamentViewInput, ViewEdition, ViewRules } from './types';

export function groupPhaseOpen(matches: readonly MatchView[]): boolean {
  return matches.some(
    (m) => m.phase === 'groupStage' && m.status !== 'finished' && m.status !== 'awarded' && m.status !== 'cancelled',
  );
}

function rankingComplete(input: Pick<TournamentViewInput, 'teams' | 'finalRanking'>): boolean {
  const ranked = new Set((input.finalRanking ?? []).map((entry) => entry.team.id));
  const teams = input.teams.filter((team) => team.isRemoved !== true);
  return teams.length > 0 && teams.every((team) => ranked.has(team.id));
}

export function placementView(
  input: Pick<TournamentViewInput, 'teams' | 'finalRanking' | 'closed' | 'groupStandings'>,
  rules: Pick<ViewRules, 'tables'>,
  edition: ViewEdition,
  matches: readonly MatchView[],
): PlacementView {
  const final = edition !== 'blank' && input.closed === true && rankingComplete(input);
  return {
    state: final ? 'final' : 'open',
    ...(final ? { ranking: input.finalRanking } : {}),
    groupPhaseOpen: groupPhaseOpen(matches),
    ...(rules.tables && input.groupStandings !== undefined ? { groupRanks: input.groupStandings } : {}),
  };
}
