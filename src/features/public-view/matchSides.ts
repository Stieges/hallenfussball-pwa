/**
 * Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9). Jeder Zugriff auf Spiel-Seiten
 * in public-view/** läuft über diese Datei. Liest nur Slots (B-35).
 */
import type { ScheduledMatch } from '../../core/generators';
import { matchInvolvesTeam } from '../../core/models/matchSlot';

/** Ist das Team (ID) auf einer Seite des Spielplan-Eintrags beteiligt? */
export function involvesTeam(
  match: Pick<ScheduledMatch, 'slotA' | 'slotB'>,
  teamId: string
): boolean {
  return matchInvolvesTeam(match, teamId);
}
