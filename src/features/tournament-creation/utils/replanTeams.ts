/**
 * Wizard-Teams: isRemoved-Filter (Controller-Zusatz B-02, Übergabe A-05-Re-Review).
 * Ein Team mit Ergebnis-Spielen bleibt als isRemoved stehen; Step4, Zähler,
 * Duplikatprüfung und Neuplanung sehen nur aktive Teams.
 */
import type { Match, Team } from '../../../types/tournament';
import {
  getTeamMatches,
  matchHasResult,
} from '../../../utils/teamHelpers';

export function activeTeams(teams: Team[]): Team[] {
  return teams.filter((team) => !team.isRemoved);
}

export function removeTeamKeepingHistory(
  teams: Team[],
  matches: Match[],
  teamId: string
): Team[] {
  const hasResults = getTeamMatches(matches, teamId).some(matchHasResult);
  if (!hasResults) {
    return teams.filter((team) => team.id !== teamId);
  }
  return teams.map((team) =>
    team.id === teamId
      ? { ...team, isRemoved: true, removedAt: new Date().toISOString() }
      : team
  );
}
