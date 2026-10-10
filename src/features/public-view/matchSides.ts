/**
 * Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9). Jeder Zugriff auf Spiel-Seiten
 * in public-view/** läuft über diese Datei. B-35 stellt genau diese Funktionen später auf Slots um.
 */
import type { ScheduledMatch } from '../../core/generators';
import type { Match, Team } from '../../types/tournament';

/** Ist das Team (ID) auf einer Seite des Spielplan-Eintrags beteiligt? */
export function involvesTeam(
  match: Pick<ScheduledMatch, 'originalTeamA' | 'originalTeamB'>,
  teamId: string
): boolean {
  return match.originalTeamA === teamId || match.originalTeamB === teamId;
}

/** Anzeigename einer Seite; unbekannte ID (z. B. Platzhalter „winner-semi-1“) wird wörtlich zurückgegeben. */
export function sideLabel(match: Pick<Match, 'teamA' | 'teamB'>, side: 'A' | 'B', teams: Team[]): string {
  const id = side === 'A' ? match.teamA : match.teamB;
  return teams.find((team) => team.id === id)?.name ?? id;
}
