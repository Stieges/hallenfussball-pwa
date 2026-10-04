/**
 * sideLabel — EIN Zugriffspunkt auf match.teamA/teamB im Wizard-Modul
 * (Ein-Stellen-Regel W1–W3). B-35 stellt genau diese Adapter-Funktion
 * später auf Slots um.
 */
import type { Match, Team } from '../../../types/tournament';

export function sideLabel(
  match: Pick<Match, 'teamA' | 'teamB'>,
  side: 'A' | 'B',
  teams: Team[]
): string {
  const id = side === 'A' ? match.teamA : match.teamB;
  return teams.find((team) => team.id === id)?.name ?? id;
}
