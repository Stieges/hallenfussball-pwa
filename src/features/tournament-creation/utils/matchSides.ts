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

/**
 * Ersetzt eine Seiten-Zuordnung (Team-Wechsel @W5-010) – zweiter und letzter
 * Zugriff auf match.teamA/teamB in diesem Modul (Ein-Stellen-Regel).
 */
export function replaceSides(
  match: Match,
  fromTeamId: string,
  toTeamId: string
): Match {
  return {
    ...match,
    teamA: match.teamA === fromTeamId ? toTeamId : match.teamA,
    teamB: match.teamB === fromTeamId ? toTeamId : match.teamB,
  };
}
