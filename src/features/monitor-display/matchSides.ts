/**
 * Teamzuordnung eines Spiels zu Seite A/B (B-16d1, Spec § 2 Nr. 9).
 * Die Suche nach ID oder Name und der Rückfall auf den Rohwert stammen wörtlich aus dem
 * Monitor (vormals getTeamName): unbekannte ID wird als Text angezeigt.
 */
import type { Match, Team } from '../../types/tournament';

export type MatchSide = 'A' | 'B';

const sideId = (match: Match, side: MatchSide): string => (side === 'A' ? match.teamA : match.teamB);

/** Team der Seite (per ID oder Name); `undefined`, wenn es das Team nicht gibt. */
export function sideTeam(match: Match, side: MatchSide, teams: Team[]): Team | undefined {
  const idOrName = sideId(match, side);
  return teams.find(t => t.id === idOrName || t.name === idOrName);
}

/** Anzeigename der Seite; ohne Treffer der Rohwert (ID) als Text. */
export function sideLabel(match: Match, side: MatchSide, teams: Team[]): string {
  const team = sideTeam(match, side, teams);
  return team?.name ?? sideId(match, side);
}
