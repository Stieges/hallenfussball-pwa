/**
 * Inhalte der Monitor-Folien (B-16f1, f3): reine Auswahl- und Seitenfunktionen, ohne React.
 *
 * Sortierung, „nächste Spiele“, Feldplan, Tabellen-Abschnitte und Seitenzahl. Die Folien rufen nur diese
 * Funktionen auf; die Takt-Logik (Seiten je Folie) liegt in slideProgramme.ts und bekommt die Seitenzahl
 * über `pageCount`.
 */
import type { Match, Tournament } from '../../types/tournament';
import { DEFAULT_SLIDE_CONFIG } from '../../types/monitor';
import { isMatchInProgress, type ProgramSlide } from './slideProgramme';
import { fieldIdToNumber } from './monitorDisplayHelpers';

/** Zeilen je Seite bis B-17 misst (@ZM-129). */
export const MONITOR_ROWS_PER_PAGE = 6;

function compareNumbers(x: number, y: number): number {
  if (x === y) { return 0; }
  return x < y ? -1 : 1;
}

/** Anpfiff in ms; fehlt er (oder ist unlesbar), steht das Spiel ans Ende. */
function kickoffMs(match: Match): number {
  if (match.scheduledTime === undefined || match.scheduledTime === null) { return Number.POSITIVE_INFINITY; }
  // scheduledTime ist aus JSON ein String, im Speicher ein Date; new Date() deckt beides ab.
  const ms = new Date(match.scheduledTime).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** Anpfiff, dann Spielnummer, dann Runde, dann Id (stabil bei gleicher Uhrzeit). */
export function compareKickoff(a: Match, b: Match): number {
  const byTime = compareNumbers(kickoffMs(a), kickoffMs(b));
  if (byTime !== 0) { return byTime; }
  const byNumber = compareNumbers(a.matchNumber ?? Number.POSITIVE_INFINITY, b.matchNumber ?? Number.POSITIVE_INFINITY);
  if (byNumber !== 0) { return byNumber; }
  const byRound = compareNumbers(a.round, b.round);
  if (byRound !== 0) { return byRound; }
  if (a.id === b.id) { return 0; }
  return a.id < b.id ? -1 : 1;
}

/** Noch offen: ohne Status, angesetzt oder wartend. Laufend (auch unterbrochen) und beendet/übersprungen nie. */
export function isUpcoming(match: Match): boolean {
  if (isMatchInProgress(match)) { return false; }
  const status = match.matchStatus;
  return status === undefined || status === null || status === 'scheduled' || status === 'waiting';
}

/** Die nächsten offenen Spiele in Anpfiff-Reihenfolge; optional nur ein Feld. Liefert eine neue Liste. */
export function upcomingMatches(matches: readonly Match[], opts: { count: number; field?: number }): Match[] {
  return matches
    .filter(m => isUpcoming(m) && (opts.field === undefined || m.field === opts.field))
    .sort(compareKickoff)
    .slice(0, Math.max(0, opts.count));
}

/** Alle Spiele eines Feldes (beendet, laufend und offen) in Anpfiff-Reihenfolge. */
export function fieldSchedule(matches: readonly Match[], field: number): Match[] {
  return matches.filter(m => m.field === field).sort(compareKickoff);
}

/** Zeilen „Nächste Spiele“ einer Folie: die nächsten offenen Spiele, höchstens `matchCount` (Vorgabe aus DEFAULT_SLIDE_CONFIG). */
export function nextMatchList(matches: readonly Match[], matchCount: number | undefined): Match[] {
  return upcomingMatches(matches, { count: matchCount ?? DEFAULT_SLIDE_CONFIG.matchCount ?? 3 });
}

/** Finalrunde: K.O.-Spiele (`isFinal` oder eine Phase außer der Gruppenphase), in Anpfiff-Reihenfolge. */
export function finalRoundMatches(matches: readonly Match[]): Match[] {
  return matches
    .filter(m => m.isFinal === true || (m.phase !== undefined && m.phase !== 'groupStage'))
    .sort(compareKickoff);
}

/** Gruppen-IDs: aus der Gruppenkonfiguration, sonst aus den Teams (sortiert, ohne Dubletten). */
export function groupIds(tournament: Tournament): string[] {
  if (tournament.groups && tournament.groups.length > 0) {
    return tournament.groups.map(g => g.id);
  }
  const ids = new Set<string>();
  tournament.teams.forEach(team => { if (team.group) { ids.add(team.group); } });
  return [...ids].sort();
}

/** Ein Abschnitt der Folie „Alle Tabellen / Finalrunde“: eine Gruppentabelle oder die Finalrunde. */
export type StandingsSection = { kind: 'group'; groupId: string } | { kind: 'finals' };

/** Abschnitte je Seite (R-f3): je Gruppe eine Tabelle, danach die Finalrunde, wenn es Finalspiele gibt. */
export function standingsSections(tournament: Tournament): StandingsSection[] {
  const sections: StandingsSection[] = groupIds(tournament).map(groupId => ({ kind: 'group', groupId }));
  if (finalRoundMatches(tournament.matches).length > 0) { sections.push({ kind: 'finals' }); }
  return sections;
}

/** Zeilen der Seite `page` (0-basiert). Jede Zeile liegt auf genau einer Seite. */
export function pageOf<T>(items: readonly T[], page: number, perPage: number = MONITOR_ROWS_PER_PAGE): T[] {
  const start = page * perPage;
  return items.slice(start, start + perPage);
}

/** Anzahl Seiten für `items` Zeilen; mindestens eine (auch bei null Zeilen). */
export function pagesFor(items: number, perPage: number = MONITOR_ROWS_PER_PAGE): number {
  return Math.max(1, Math.ceil(items / perPage));
}

/**
 * Seitenzahl einer Folie für den Takt (B-16f1, f3). Alle Tabellen: ein Abschnitt je Seite. Spielplan und
 * Nächste Spiele: je MONITOR_ROWS_PER_PAGE Zeilen. Andere Folien: eine Seite. B-17 misst die Seitenzahl.
 */
export function monitorPageCount(slide: ProgramSlide, tournament?: Tournament | null): number {
  if (!tournament || !('config' in slide)) { return 1; }
  switch (slide.type) {
    case 'all-standings':
      return Math.max(1, standingsSections(tournament).length);
    case 'schedule-field':
      return pagesFor(fieldSchedule(tournament.matches, fieldIdToNumber(slide.config.fieldId)).length);
    case 'next-matches':
      return pagesFor(nextMatchList(tournament.matches, slide.config.matchCount).length);
    default:
      return 1;
  }
}
