/**
 * Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9). Jeder Zugriff auf Spiel-Seiten
 * in public-view/** läuft über diese Datei. Liest nur Slots (B-35).
 */
import type { ScheduledMatch } from '../../core/generators';
import type { Match, Team } from '../../types/tournament';
import { slotLabel } from '../../core/models/slotLabel';
import { matchInvolvesTeam, slotTeamId } from '../../core/models/matchSlot';

/** Ist das Team (ID) auf einer Seite des Spielplan-Eintrags beteiligt? */
export function involvesTeam(
  match: Pick<ScheduledMatch, 'slotA' | 'slotB'>,
  teamId: string
): boolean {
  return matchInvolvesTeam(match, teamId);
}

/** Anzeigename einer Seite; unbekannte Team-ID wird wörtlich zurückgegeben, eine offene Seite zeigt ihre Herkunft. */
export function sideLabel(match: Pick<Match, 'slotA' | 'slotB'>, side: 'A' | 'B', teams: Team[]): string {
  const slot = side === 'A' ? match.slotA : match.slotB;
  const id = slotTeamId(slot);
  if (id !== undefined && !teams.some((team) => team.id === id)) {
    return id;
  }
  return slotLabel(slot, { teams, matches: [] });
}
