/**
 * Anzeige der beiden Spielseiten im Spielplan (A-04a, @TM-015).
 *
 * Eine Funktion für alle Spielplan-Karten: Der Name kommt immer aus `slotLabel` (Team-ID → aktueller
 * Teamname, offene Seite → Herkunft). Der im Spiel gespeicherte Anzeigetext (`ScheduledMatch.homeTeam/awayTeam`)
 * wird hier NICHT gelesen – nach dem Umbenennen eines Teams zeigt der Spielplan sofort den neuen Namen.
 */
import { slotLabel, type SlotLabelMatch } from '../../core/models/slotLabel';
import { slotTeamId } from '../../core/models/matchSlot';
import type { ScheduledMatch } from '../../core/generators';
import type { Team, TournamentGroup } from '../../types/tournament';
import type { TeamForDisplay } from '../../utils/teamHelpers';

type SideTeam = Pick<Team, 'id' | 'name'> & Partial<Pick<Team, 'logo' | 'colors'>>;

/** Alles, was die Anzeige einer Spielseite braucht. */
export interface SideContext {
  teams: readonly SideTeam[];
  matches: readonly SlotLabelMatch[];
  groups?: readonly TournamentGroup[];
}

export interface SideDisplay extends TeamForDisplay {
  /** Die Seite ist noch nicht besetzt (zeigt ihre Herkunft). */
  pending: boolean;
}

type SideMatch = Pick<ScheduledMatch, 'id' | 'slotA' | 'slotB'>;

/** Quelle der Anzeige-Daten: ein `Tournament` oder ein Teil davon (z. B. der Stand-in in `ScheduleDisplay`). */
export interface SideSource {
  teams?: readonly SideTeam[];
  groups?: readonly TournamentGroup[];
  matches?: readonly SlotLabelMatch[];
}

/** Kontext aus dem Turnier und den angezeigten Spielen (Vorgängerspiele stehen oft nur im Angezeigten). */
export function buildSideContext(
  tournament: SideSource | undefined,
  shownMatches: readonly SlotLabelMatch[] = [],
): SideContext {
  const known = new Set(shownMatches.map((match) => match.id));
  const persisted = (tournament?.matches ?? []).filter((match) => !known.has(match.id));
  return {
    teams: tournament?.teams ?? [],
    matches: [...shownMatches, ...persisted],
    groups: tournament?.groups,
  };
}

/** Anzeige einer Seite (`'A'` = Heim). Ein gespeicherter Anzeigename wird nie gelesen. */
export function sideDisplay(match: SideMatch, side: 'A' | 'B', ctx: SideContext): SideDisplay {
  const slot = side === 'A' ? match.slotA : match.slotB;
  const name = slotLabel(slot, ctx);
  const teamId = slotTeamId(slot);
  const team = teamId === undefined ? undefined : ctx.teams.find((candidate) => candidate.id === teamId);
  return {
    id: teamId ?? `${match.id}:${side}`,
    name,
    logo: team?.logo,
    colors: team?.colors,
    pending: teamId === undefined,
  };
}

/** Nur der Text einer Seite. */
export function sideName(match: SideMatch, side: 'A' | 'B', ctx: SideContext): string {
  return sideDisplay(match, side, ctx).name;
}
