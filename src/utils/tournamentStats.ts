/**
 * Tournament Stats Snapshot — reine Funktionen für den Turnierabschluss.
 * Extrahiert aus useTournaments.ts (dort lokale const im Hook, nicht importierbar), damit Admin-Center
 * und useTournaments.finishTournament dieselbe Logik verwenden.
 */
import type { Tournament, TournamentStatsSnapshot } from '../types/tournament';

/** Verhalten 1:1 aus useTournaments.ts:217–238 — ein Spiel gilt nur als gespielt, wenn BEIDE Scores Zahlen sind. */
export function createStatsSnapshot(tournament: Tournament): TournamentStatsSnapshot {
  const { matches, teams } = tournament;
  const completedMatches = matches.filter((m) => typeof m.scoreA === 'number' && typeof m.scoreB === 'number').length;
  const totalGoals = matches.reduce((sum, m) => sum + (m.scoreA ?? 0) + (m.scoreB ?? 0), 0);
  return { teamCount: teams.length, totalMatches: matches.length, completedMatches, totalGoals, createdAt: new Date().toISOString() };
}

/**
 * Patch für einen manuellen Turnierabschluss — einzige Wahrheit für „Turnier ist beendet".
 * `manuallyCompleted` ist das Feld, das utils/tournamentCategories.ts tatsächlich liest;
 * `dashboardStatus` allein wird dort nirgends ausgewertet (Ursache von L5).
 */
export function buildFinishTournamentPatch(tournament: Tournament): Partial<Tournament> {
  const now = new Date().toISOString();
  return { manuallyCompleted: true, completedAt: now, statsSnapshot: createStatsSnapshot(tournament), dashboardStatus: 'finished', updatedAt: now };
}
