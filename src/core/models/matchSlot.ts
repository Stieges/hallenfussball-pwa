/**
 * Hilfsfunktionen für Spielseiten als Slot (A-01, MVP-Bauplan Spur A; Vorlage V-TEAM-Plan V7).
 * Framework-frei. Konstruktoren prüfen über Zod – ein Teamname oder eine Definitions-ID (`'semi1'`)
 * wird hier laut abgelehnt statt still gespeichert.
 *
 * Anforderung: @TM-015 („Ein unbesetzter Platz zeigt seine Herkunft“).
 */
import {
  TeamIdSchema,
  SlotSourceSchema,
  type MatchSlot,
  type PendingSlot,
  type SlotSource,
  type TeamId,
  type TeamSlot,
} from './schemas/MatchSlotSchema';

/** Beide Seiten eines Spiels. */
export interface MatchSides {
  slotA: MatchSlot;
  slotB: MatchSlot;
}

/** Besetzte Seite. Wirft, wenn `id` keine Team-ID (UUID) ist. */
export function teamSlot(id: string, resolvedFrom?: SlotSource): TeamSlot {
  const teamId = TeamIdSchema.parse(id);
  return resolvedFrom === undefined
    ? { kind: 'team', teamId }
    : { kind: 'team', teamId, resolvedFrom: SlotSourceSchema.parse(resolvedFrom) };
}

/** Offene Seite mit Herkunft. Wirft bei ungültiger Herkunft. */
export function pendingSlot(source: SlotSource): PendingSlot {
  return { kind: 'pending', source: SlotSourceSchema.parse(source) };
}

export function isPendingSlot(slot: MatchSlot): slot is PendingSlot {
  return slot.kind === 'pending';
}

/** Team-ID der Seite oder `undefined`, solange sie offen ist. */
export function slotTeamId(slot: MatchSlot): TeamId | undefined {
  return slot.kind === 'team' ? slot.teamId : undefined;
}

/** Herkunft der Seite: offen → `source`, aufgelöst → `resolvedFrom`, direkt besetzt → `undefined`. */
export function slotSource(slot: MatchSlot): SlotSource | undefined {
  return slot.kind === 'pending' ? slot.source : slot.resolvedFrom;
}

/** Team-IDs der besetzten Seiten (Heim zuerst). */
export function matchTeamIds(match: MatchSides): TeamId[] {
  return [slotTeamId(match.slotA), slotTeamId(match.slotB)].filter((id): id is TeamId => id !== undefined);
}

/** Spielt das Team in diesem Spiel? Offene Seiten zählen nie. */
export function matchInvolvesTeam(match: MatchSides, teamId: string): boolean {
  return matchTeamIds(match).some((id) => id === teamId);
}

/** Ist mindestens eine Seite noch offen? */
export function matchAwaitsTeams(match: MatchSides): boolean {
  return isPendingSlot(match.slotA) || isPendingSlot(match.slotB);
}

/** Auflösung einer Herkunft: Team gesetzt, Herkunft bleibt in `resolvedFrom`. */
export function resolveSlot(source: SlotSource, teamId: string): TeamSlot {
  return teamSlot(teamId, source);
}

/** Team-ID einer Seite, die besetzt sein MUSS (Generator-Invariante). */
export function requireTeamId(slot: MatchSlot): TeamId {
  const id = slotTeamId(slot);
  if (id === undefined) {
    throw new Error('Gruppenspiel ohne Team');
  }
  return id;
}

function mapId(map: ReadonlyMap<string, string>, id: string, what: string): string {
  const mapped = map.get(id);
  if (mapped === undefined) {
    throw new Error(`Kopie: keine neue ${what} für ${id}`);
  }
  return mapped;
}

function copySource(source: SlotSource, matchIdMap: ReadonlyMap<string, string>): SlotSource {
  return source.kind === 'matchResult'
    ? { ...source, matchId: mapId(matchIdMap, source.matchId, 'Spiel-ID') }
    : source;
}

/**
 * Seite für eine Turnier-Kopie (V-TEAM V14): Direkt besetzte Seiten bekommen die neue Team-ID,
 * aufgelöste Seiten werden wieder offen (die Kopie hat keine Ergebnisse), Spiel-Verweise zeigen auf die
 * neuen Spiel-IDs. Fehlende Zuordnung → Error.
 */
export function copySlot(
  slot: MatchSlot,
  teamIdMap: ReadonlyMap<string, string>,
  matchIdMap: ReadonlyMap<string, string>,
): MatchSlot {
  if (slot.kind === 'pending') {
    return pendingSlot(copySource(slot.source, matchIdMap));
  }
  if (slot.resolvedFrom !== undefined) {
    return pendingSlot(copySource(slot.resolvedFrom, matchIdMap));
  }
  return teamSlot(mapId(teamIdMap, slot.teamId, 'Team-ID'));
}
