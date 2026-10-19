/**
 * Mannschaften des Veranstalters und Wahl der Eröffnung (@W4-027, @W4-033, @W4-034, @W4-041, @W4-044).
 * Reine Logik für Generator, Speichern und Assistent (die Oberfläche baut darauf auf).
 */
import { OPENING_MODES, type GroupSystem, type OpeningMode, type Team } from '../../types/tournament';

type TeamRef = Pick<Team, 'id'> & Partial<Pick<Team, 'group'>>;

/**
 * Wirksame Markierungen: nur IDs vorhandener Teams, ohne Dubletten, in der Reihenfolge der Teamliste.
 * Eine verwaiste ID (Team gelöscht) hinterlässt keine Regel (@W4-044).
 */
export function effectiveHostTeamIds(hostTeamIds: readonly string[] | undefined, teams: readonly TeamRef[]): string[] {
  if (!hostTeamIds || hostTeamIds.length === 0) { return []; }
  const marked = new Set(hostTeamIds);
  return teams.filter((team) => marked.has(team.id)).map((team) => team.id);
}

/** Liest eine gespeicherte Eröffnungswahl; Unbekanntes gilt als nicht gesetzt. */
export function parseOpeningMode(value: unknown): OpeningMode | undefined {
  return OPENING_MODES.find((mode) => mode === value);
}

/** Liest eine gespeicherte Markierungsliste; nur Strings zählen. */
export function parseHostTeamIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) { return undefined; }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export interface HostOpeningInfo {
  /** Wirksam markierte Mannschaften (Teamliste-Reihenfolge); die erste nennt der Hinweis. */
  hostTeamIds: string[];
  /** Die Wahl „Vereinsduell eröffnet“ / „Vereinsduell in Runde 2“ wird angeboten. */
  openingChoice: boolean;
}

/**
 * Was der Assistent zur Eröffnung zeigt: die Wahl nur bei mindestens zwei markierten Mannschaften derselben Gruppe
 * und nur, wenn der Spielplan ein Runden-Spielplan ist (`GeneratedSchedule.roundsPlan`, @W4-041). Sonst nur der
 * Hinweis, dass eine markierte Mannschaft das erste Spiel als Heimmannschaft bestreitet (@W4-034, @W4-044).
 * Bei mehr als zwei Markierungen gilt die Wahl für die ersten zwei der Teamliste. Gruppen zählen nur bei
 * „Gruppen + Finalrunde“ (bei „jeder gegen jeden“ spielen alle in einer Gruppe, egal was am Team steht).
 */
export function hostOpeningInfo(input: {
  hostTeamIds: readonly string[] | undefined;
  teams: readonly TeamRef[];
  roundsPlan: boolean;
  groupSystem?: GroupSystem;
}): HostOpeningInfo {
  const hostTeamIds = effectiveHostTeamIds(input.hostTeamIds, input.teams);
  if (hostTeamIds.length < 2 || !input.roundsPlan) { return { hostTeamIds, openingChoice: false }; }
  if (input.groupSystem === 'roundRobin') { return { hostTeamIds, openingChoice: true }; }
  const groupOf = (id: string): string | undefined => input.teams.find((team) => team.id === id)?.group;
  return { hostTeamIds, openingChoice: groupOf(hostTeamIds[0]) === groupOf(hostTeamIds[1]) };
}
