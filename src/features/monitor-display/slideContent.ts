/**
 * Inhalte der Monitor-Folien (B-16f1, f3): reine Auswahl- und Seitenfunktionen, ohne React.
 *
 * Sortierung, „nächste Spiele“, Feldplan, Tabellen-Abschnitte und Seitenzahl. Die Folien rufen nur diese
 * Funktionen auf; die Takt-Logik (Seiten je Folie) liegt in slideProgramme.ts und bekommt die Seitenzahl
 * über `pageCount`.
 */
import type { Tournament } from '../../types/tournament';
import type { MatchView, TournamentView } from '../../core/view';
import { DEFAULT_SLIDE_CONFIG } from '../../types/monitor';
import type { ProgramSlide } from './slideProgramme';
import { fieldIdToNumber } from './monitorDisplayHelpers';

/** Zeilen je Seite bis B-17 misst (@ZM-129). */
export const MONITOR_ROWS_PER_PAGE = 6;

function compareNumbers(x: number, y: number): number {
  if (x === y) { return 0; }
  return x < y ? -1 : 1;
}

/** Anpfiff als Sortierschlüssel in Turnier-Ortszeit (@ZM-111, nie Gerätezeit); fehlt er, steht das Spiel ans Ende. */
function kickoffKey(match: MatchView): string {
  return match.kickoff === undefined ? '9999-99-99 99:99' : `${match.kickoff.date} ${match.kickoff.time}`;
}

/** Anpfiff, dann Spielnummer, dann Id (stabil bei gleicher Uhrzeit). */
export function compareKickoff(a: MatchView, b: MatchView): number {
  const byTime = kickoffKey(a).localeCompare(kickoffKey(b));
  if (byTime !== 0) { return byTime; }
  const byNumber = compareNumbers(a.matchNumber ?? Number.POSITIVE_INFINITY, b.matchNumber ?? Number.POSITIVE_INFINITY);
  if (byNumber !== 0) { return byNumber; }
  if (a.id === b.id) { return 0; }
  return a.id < b.id ? -1 : 1;
}

/**
 * Die nächsten offenen Spiele in Anpfiff-Reihenfolge; optional nur ein Feld. „Offen“ ist allein `MatchView.isUpcoming`:
 * laufende, unterbrochene, beendete und ausgefallene Spiele sind nie „nächstes Spiel“ (@ZM-041, @ZM-104).
 */
export function upcomingMatches(view: TournamentView, opts: { count: number; field?: number }): MatchView[] {
  return view.matches
    .filter(m => m.isUpcoming && (opts.field === undefined || m.field === opts.field))
    .sort(compareKickoff)
    .slice(0, Math.max(0, opts.count));
}

/** Alle Spiele eines Feldes (beendet, laufend und offen) in Anpfiff-Reihenfolge. */
export function fieldSchedule(view: TournamentView, field: number): MatchView[] {
  return view.matches.filter(m => m.field === field).sort(compareKickoff);
}

/** Zeilen „Nächste Spiele“ einer Folie: die nächsten offenen Spiele, höchstens `matchCount` (Vorgabe aus DEFAULT_SLIDE_CONFIG). */
export function nextMatchList(view: TournamentView, matchCount: number | undefined): MatchView[] {
  return upcomingMatches(view, { count: matchCount ?? DEFAULT_SLIDE_CONFIG.matchCount ?? 3 });
}

/** Trägt eine Zeile einen Hinweis unter der Uhrzeit („ursprünglich“, „voraussichtlich“)? Dann sind alle Uhrzeit-Spalten breiter (B-27). */
export function hasTimeNotes(rows: readonly MatchView[]): boolean {
  return rows.some(m => m.originalKickoff !== undefined || m.kickoffTentative);
}

/** Finalrunde: die K.-o.-Spiele der Ansicht, in Anpfiff-Reihenfolge. */
export function finalRoundMatches(view: TournamentView): MatchView[] {
  return view.matches.filter(m => m.phase === 'final').sort(compareKickoff);
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
export type StandingsSection = { kind: 'group'; groupId: string } | { kind: 'overall' } | { kind: 'finals' };

/**
 * Abschnitte je Seite (R-f3): je Gruppe eine Tabelle, danach die Finalrunde, wenn es Finalspiele gibt.
 * Ohne Gruppen (Jeder gegen Jeden, Controller-Ruling B-16f3 Fixrunde 1): eine Gesamttabelle über alle Teams.
 */
export function standingsSections(tournament: Tournament, view: TournamentView): StandingsSection[] {
  const ids = groupIds(tournament);
  const sections: StandingsSection[] = ids.map(groupId => ({ kind: 'group', groupId }));
  if (ids.length === 0 && tournament.teams.length > 0) { sections.push({ kind: 'overall' }); }
  if (finalRoundMatches(view).length > 0) { sections.push({ kind: 'finals' }); }
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
export function monitorPageCount(slide: ProgramSlide, tournament?: Tournament | null, view?: TournamentView | null): number {
  if (!tournament || !view || !('config' in slide)) { return 1; }
  switch (slide.type) {
    case 'all-standings':
      return Math.max(1, standingsSections(tournament, view).length);
    case 'schedule-field':
      return pagesFor(fieldSchedule(view, fieldIdToNumber(slide.config.fieldId)).length);
    case 'next-matches':
      return pagesFor(nextMatchList(view, slide.config.matchCount).length);
    default:
      return 1;
  }
}
