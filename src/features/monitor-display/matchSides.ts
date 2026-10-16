/**
 * Teamzuordnung eines Spiels zu Seite A/B am Monitor (B-16d1, Spec § 2 Nr. 9).
 *
 * Merge main → Spur B (I1): Die Seiten kommen aus dem Slot (`slotA`/`slotB`, A-03), nicht mehr aus dem
 * Übergangsfeld `teamA`/`teamB`. Das Team wird nur über die ID gefunden (`monitorSideTeam`); den Text
 * liefert die eine Anzeigefunktion `slotLabel` (@TM-015 Herkunft offener Plätze, unbekannte ID → `slot.unknown`).
 *
 * B-16f2: `sideLabel` ist die eine Stelle für die Herkunft offener Plätze am Monitor. Bei ausgeblendeten
 * Ergebnissen (Kindermodus, @W2A-031) steht dort „noch offen“ (`tournament:slot.undecided`).
 * B-41: Der Monitor bleibt fest deutsch (`ANZEIGE_SPRACHE`), unabhängig von der Gerätesprache.
 */
import { ANZEIGE_SPRACHE } from '../../i18n/anzeigeSprache';
import { slotLabel } from '../../core/models/slotLabel';
import type { Match, Team, TournamentGroup } from '../../types/tournament';
import { monitorSideTeam } from './monitorSides';
import { monitorTeamName } from '../../core/models/teamNameAbbrev';

export type MatchSide = 'A' | 'B';

/** Kontext der Anzeige: Teams des Turniers und ob die Herkunft offener Plätze verborgen wird. */
export interface SideContext {
  teams: Team[];
  /** Spiele des Turniers – nötig, um „Sieger/Verlierer <Spiel>“ zu benennen. */
  matches?: readonly Match[];
  /** Gruppen des Turniers – für eigene Gruppennamen in der Herkunft. */
  groups?: readonly TournamentGroup[];
  /** true = Kindermodus (Ergebnisse ausgeblendet): offener Platz zeigt „noch offen“. */
  hidePendingOrigin?: boolean;
}

/** Team der Seite (nur per ID aus dem Slot); `undefined`, solange die Seite offen ist oder das Team fehlt. */
export function sideTeam(match: Match, side: MatchSide, teams: readonly Team[]): Team | undefined {
  return monitorSideTeam(match, side, teams);
}

/**
 * Anzeigename der Seite. Besetzt: Teamname. Offen: Kindermodus → „noch offen“, sonst die lesbare
 * Herkunft („1. Gruppe A“, „Sieger 1. Halbfinale“).
 */
export function sideLabel(match: Match, side: MatchSide, ctx: SideContext): string {
  return slotLabel(side === 'A' ? match.slotA : match.slotB, {
    teams: ctx.teams,
    matches: ctx.matches ?? [],
    groups: ctx.groups,
    hidePendingOrigin: ctx.hidePendingOrigin,
    locale: ANZEIGE_SPRACHE,
  });
}

/**
 * Anzeigename der Seite am Monitor (MS1, @ZM-087): besetzt → Teamname mit Vereinskürzeln nach Liste
 * (`monitorTeamName`), offen → Herkunft bzw. „noch offen“ wie `sideLabel`.
 */
export function monitorSideLabel(match: Match, side: MatchSide, ctx: SideContext): string {
  const team = sideTeam(match, side, ctx.teams);
  return team ? monitorTeamName(team.name) : sideLabel(match, side, ctx);
}
