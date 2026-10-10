/**
 * sideLabel — EIN Zugriffspunkt auf match.teamA/teamB im Wizard-Modul
 * (Ein-Stellen-Regel W1–W3). B-35 stellt genau diese Adapter-Funktion
 * später auf Slots um.
 */
import type { Match, Team } from '../../../types/tournament';
import { matchSideTeamId } from '../../../core/models/matchSlot';
import { assignTeamToSide } from '../../../core/models/matchAssignment';

export function sideLabel(
  match: Pick<Match, 'teamA' | 'teamB'>,
  side: 'A' | 'B',
  teams: Team[]
): string {
  const id = side === 'A' ? match.teamA : match.teamB;
  return teams.find((team) => team.id === id)?.name ?? id;
}

/**
 * Ersetzt eine Seiten-Zuordnung (Team-Wechsel @W5-010). Die Seiten werden über
 * den Slot-Helfer `assignTeamToSide` gesetzt (Slot ist die Wahrheit, das
 * Übergangsfeld `teamA/teamB` wird daraus abgeleitet).
 */
export function replaceSides(
  match: Match,
  fromTeamId: string,
  toTeamId: string
): Match {
  let next = match;
  if (matchSideTeamId(match, 'A') === fromTeamId) {
    next = assignTeamToSide(next, 'A', toTeamId);
  }
  if (matchSideTeamId(match, 'B') === fromTeamId) {
    next = assignTeamToSide(next, 'B', toTeamId);
  }
  return next;
}
