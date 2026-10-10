/**
 * Wizard-Teams: isRemoved-Filter (Controller-Zusatz B-02, Übergabe A-05-Re-Review).
 * Ein Team mit geschützten Spielen bleibt als isRemoved stehen (Entfernen-Regel:
 * `deleteTeamSafely` in utils/teamHelpers); Step4, Zähler, Duplikatprüfung und
 * Neuplanung sehen nur aktive Teams.
 */
import type { Team } from '../../../types/tournament';

export function activeTeams(teams: Team[]): Team[] {
  return teams.filter((team) => !team.isRemoved);
}
