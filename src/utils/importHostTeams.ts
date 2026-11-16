/**
 * Import: Mannschaften des Veranstalters und Eröffnung aus der Datei (@W4-034, @W4-033, @W4-048).
 * Die Team-Kennungen der Datei werden auf die neuen Kennungen umgesetzt; unbekannte Kennungen und unbekannte Werte
 * werden ignoriert (kein Fehler, die Datei bleibt lesbar).
 */
import { effectiveHostTeamIds, parseHostTeamIds, parseOpeningMode } from '../core/models/hostTeams';
import type { Team, Tournament } from '../types/tournament';

export function importedHostFields(
  json: Record<string, unknown>, teamIdMap: ReadonlyMap<string, string>, teams: readonly Team[],
): Pick<Tournament, 'hostTeamIds' | 'openingMode'> {
  const fields: Pick<Tournament, 'hostTeamIds' | 'openingMode'> = {};
  const fileIds = parseHostTeamIds(json.hostTeamIds);
  if (fileIds !== undefined) {
    const mapped = fileIds.map((id) => teamIdMap.get(id)).filter((id): id is string => id !== undefined);
    const marked = effectiveHostTeamIds(mapped, teams);
    if (marked.length > 0) { fields.hostTeamIds = marked; }
  }
  const mode = parseOpeningMode(json.openingMode);
  if (mode !== undefined && fields.hostTeamIds !== undefined) { fields.openingMode = mode; }
  return fields;
}
