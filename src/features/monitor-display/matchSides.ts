/**
 * Teamzuordnung eines Spiels zu Seite A/B (B-16d1, Spec § 2 Nr. 9).
 * Die Suche nach ID oder Name und der Rückfall auf den Rohwert stammen wörtlich aus dem
 * Monitor (vormals getTeamName): unbekannte ID wird als Text angezeigt.
 *
 * B-16f2: `sideLabel` ist die eine Stelle für die Herkunft offener Plätze. Ohne Team steht dort die
 * lesbare Herkunft („1. Gruppe A“, „Sieger 1. Halbfinale“); bei ausgeblendeten Ergebnissen (Kindermodus,
 * @W2A-031) steht stattdessen „noch offen“ (`tournament:slot.undecided`, wortgleich zu Spur A).
 */
import { anzeigeT } from '../../i18n/anzeigeSprache';
import type { Match, Team } from '../../types/tournament';
import { resolvePlayoffPlaceholder } from '../../utils/displayNames';

export type MatchSide = 'A' | 'B';

/** Kontext der Anzeige: Teams des Turniers und ob die Herkunft offener Plätze verborgen wird. */
export interface SideContext {
  teams: Team[];
  /** true = Kindermodus (Ergebnisse ausgeblendet): offener Platz zeigt „noch offen“. */
  hidePendingOrigin?: boolean;
}

const sideId = (match: Match, side: MatchSide): string => (side === 'A' ? match.teamA : match.teamB);

/** Team der Seite (per ID oder Name); `undefined`, wenn es das Team nicht gibt. */
export function sideTeam(match: Match, side: MatchSide, teams: Team[]): Team | undefined {
  const idOrName = sideId(match, side);
  return teams.find(t => t.id === idOrName || t.name === idOrName);
}

/**
 * Anzeigename der Seite. Mit Team: Teamname. Ohne Team: Kindermodus → „noch offen“, sonst die
 * lesbare Herkunft (Platzhalter aufgelöst; unbekannte ID bleibt Text).
 */
export function sideLabel(match: Match, side: MatchSide, ctx: SideContext): string {
  const team = sideTeam(match, side, ctx.teams);
  if (team) { return team.name; }
  if (ctx.hidePendingOrigin) { return anzeigeT('tournament:slot.undecided'); }
  return resolvePlayoffPlaceholder(sideId(match, side), 'de');
}
