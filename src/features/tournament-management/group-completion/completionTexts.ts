/**
 * Textbausteine für „Gruppe abschließen“ (GA4 A-13c): Gruppenname, Namenslisten, Zeit. Alles in der Sprache der App; die
 * Übersetzungen stehen in `tournament.json` → `groupCompletion`. Rein, ohne React.
 */
import type { Match, Tournament } from '../../../types/tournament';
import { matchSideTeamId } from '../../../core/models/matchSlot';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { OVERALL_GROUP } from '../../../core/models/standingsGroups';
import { matchLabelText } from '../../../core/view/originText';

/** Name der Gruppe wie in der Tabelle („Gruppe A“ oder der eigene Name); `undefined` bei Jeder gegen jeden (keine Gruppe im Bild). */
export function groupNameOf(tournament: Pick<Tournament, 'groups'>, groupId: string): string | undefined {
  return groupId === OVERALL_GROUP ? undefined : getGroupDisplayName(groupId, tournament);
}

/** Variablen einer Übersetzung mit Gruppenname; ohne Namen greift die Fassung `_all` („Gruppe“ ohne Buchstaben). */
export const withGroup = (name: string | undefined, vars: Record<string, unknown> = {}): Record<string, unknown> =>
  name === undefined ? { ...vars, context: 'all' } : { ...vars, name };

/** „SV Süd – TSV West“ für ein Spiel (Namen aus den Teams des Turniers). */
export function matchText(tournament: Pick<Tournament, 'teams'>, match: Match): string {
  const nameOf = (side: 'A' | 'B'): string => {
    const teamId = matchSideTeamId(match, side);
    return tournament.teams.find((team) => team.id === teamId)?.name ?? '';
  };
  return `${nameOf('A')} – ${nameOf('B')}`;
}

export const signed = (value: number): string => (value > 0 ? `+${String(value)}` : value < 0 ? `−${String(Math.abs(value))}` : '0');

/** Spielbezeichnung („1. Halbfinale“) übersetzt; fehlt eine Übersetzung, gilt die gespeicherte Bezeichnung. */
export const labelText = (label: string): string => (label === '' ? '' : matchLabelText(label) || label);
