/**
 * Spielseiten-Anzeige des Hallen-Monitors (@TM-015 „Ein unbesetzter Platz zeigt seine Herkunft“, @TM-036 Kindermodus).
 *
 * Der Name kommt aus dem Slot (`slotLabel`), nicht aus dem Übergangsfeld `teamA`/`teamB` (dort steht bei offenen
 * Seiten `'TBD'`). Ist `hideScoresForPublic` gesetzt, zeigt der Monitor bei offenen Seiten „noch offen“ statt
 * einer Herkunft mit Platz; besetzte Seiten bleiben beim Teamnamen.
 */
import { slotLabel } from '../../core/models/slotLabel';
import { slotTeamId } from '../../core/models/matchSlot';
import type { Match, Team, Tournament } from '../../types/tournament';

export type MonitorSideSource = Pick<Tournament, 'teams' | 'matches' | 'groups' | 'hideScoresForPublic'>;

/** Anzeigetext einer Spielseite (`'A'` = Heim). */
export function monitorSideName(match: Match, side: 'A' | 'B', source: MonitorSideSource): string {
  return slotLabel(side === 'A' ? match.slotA : match.slotB, {
    teams: source.teams,
    matches: source.matches,
    groups: source.groups,
    hidePendingOrigin: source.hideScoresForPublic,
  });
}

/** Das besetzte Team der Seite (für Logo und Farben) oder `undefined`, solange sie offen ist. */
export function monitorSideTeam(match: Match, side: 'A' | 'B', teams: readonly Team[]): Team | undefined {
  const teamId = slotTeamId(side === 'A' ? match.slotA : match.slotB);
  return teamId === undefined ? undefined : teams.find((team) => team.id === teamId);
}
