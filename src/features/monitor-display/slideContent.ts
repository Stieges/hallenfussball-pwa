/**
 * Inhalte der Monitor-Folien (B-16f1): reine Auswahl- und Seitenfunktionen, ohne React.
 *
 * Sortierung, „nächste Spiele“, Feldplan und Seitenschnitt. Die Folien (f2/f3) rufen nur diese Funktionen auf;
 * die Takt-Logik (Seiten je Folie) liegt in slideProgramme.ts und bekommt die Seitenzahl über `pageCount`.
 */
import type { Match, Tournament } from '../../types/tournament';
import { isMatchInProgress, type ProgramSlide } from './slideProgramme';

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
 * Seitenzahl einer Folie für den Takt (B-16f1). Die Folien-Füllung (Spielplan, Tabellen) kommt in f2/f3;
 * bis dahin hat jede Folie eine Seite. B-17 misst die Seitenzahl und ersetzt diese Funktion.
 */
export function monitorPageCount(_slide: ProgramSlide, _tournament?: Tournament | null): number {
  return 1;
}
