/**
 * Spielseiten am Hallen-Monitor (A-36c, @TM-015, @ZM-087, @ZM-102): ein Weg über die gemeinsame Ansicht.
 *
 * Die Seite kommt fertig aus `MatchView` (`sideView` in `core/view`): besetzt der Teamname, offen die Herkunft
 * („Erster Gruppe A“) bzw. „noch offen“, wenn die Regeln der Ansicht den Gruppenrang nicht zeigen (`rules.groupOrigin`).
 * Am Monitor kommt nur das Vereinskürzel nach Liste dazu (`monitorTeamName`, @ZM-087) – nie ein erfundenes Kürzel.
 */
import type { SideView } from '../../core/view';
import type { Team } from '../../types/tournament';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';

/** Das besetzte Team der Seite (für Logo und Farben) oder `undefined`, solange sie offen ist. */
export function sideTeam(side: SideView, teams: readonly Team[]): Team | undefined {
  return side.teamId === undefined ? undefined : teams.find((team) => team.id === side.teamId);
}

/**
 * Anzeigename der Seite am Monitor: besetzt → Teamname mit Vereinskürzeln nach Liste, offen → Herkunft bzw.
 * „noch offen“ aus der Ansicht (nie gekürzt, nie ein Rohschlüssel).
 */
export function monitorSideLabel(side: SideView): string {
  return side.pending ? side.label : monitorTeamName(side.teamName ?? side.label);
}
