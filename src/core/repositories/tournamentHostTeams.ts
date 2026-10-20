/**
 * Mannschaften des Veranstalters und Eröffnungswahl im `tournaments.config`-JSON (@W4-034, @W4-033) – keine eigene
 * Spalte, keine Migration. Verwaiste Team-IDs werden beim Lesen ignoriert und beim Schreiben entfernt (@W4-044).
 * Ausgelagert, damit `supabaseMappers.ts` nicht wächst.
 */
import { effectiveHostTeamIds, parseHostTeamIds, parseOpeningMode } from '../models/hostTeams';
import type { Team, Tournament } from '../../types/tournament';

type HostFields = Pick<Tournament, 'hostTeamIds' | 'openingMode'>;

function hostFields(hostTeamIds: string[] | undefined, openingMode: unknown, teams: readonly Team[]): HostFields {
  const fields: HostFields = {};
  if (hostTeamIds !== undefined) { fields.hostTeamIds = effectiveHostTeamIds(hostTeamIds, teams); }
  const mode = parseOpeningMode(openingMode);
  if (mode !== undefined) { fields.openingMode = mode; }
  return fields;
}

/** Lesen aus `config` (beliebiges JSON) gegen die gelesenen Teams. */
export function hostTeamsFromConfig(config: object, teams: readonly Team[]): HostFields {
  const raw = config as { hostTeamIds?: unknown; openingMode?: unknown };
  return hostFields(parseHostTeamIds(raw.hostTeamIds), raw.openingMode, teams);
}

/** Schreiben nach `config`: nur Markierungen vorhandener Teams, nur eine gültige Wahl. */
export function hostTeamsToConfig(tournament: Pick<Tournament, 'hostTeamIds' | 'openingMode' | 'teams'>): HostFields {
  return hostFields(tournament.hostTeamIds, tournament.openingMode, tournament.teams);
}
