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
import { standingsGroups, OVERALL_GROUP } from '../../core/models/standingsGroups';
import { SPIELPLAN_FALLBACK_SLIDE, type ProgramSlide } from './slideProgramme';
import { fieldIdToNumber } from './monitorDisplayHelpers';
import { rankingPages, scorerPages } from './finalPages';
import type { MonitorEnd } from './monitorEnd';
import { DEFAULT_FRAME, listColumns, listPages, listPagesBalanced, SCHEDULE_MAX_ROWS, type ListColumns, type ListFrame } from './listRows';

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

/** Finalrunde: die K.-o.-Spiele der Ansicht, in Anpfiff-Reihenfolge. */
export function finalRoundMatches(view: TournamentView): MatchView[] {
  return view.matches.filter(m => m.phase === 'final').sort(compareKickoff);
}

/**
 * Gruppen-IDs aus der tatsächlichen Zuordnung der Teams (sortiert, ohne Dubletten) – dieselbe Quelle wie Zuschauer-Seite
 * und Einzelfolie (`standingsGroups`). `tournament.groups` zählt nicht: der Assistent speichert dort auch bei
 * „Jeder gegen jeden“ zwei Standardgruppen, denen kein Team angehört (C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN). Ohne Gruppen: leer.
 */
export function groupIds(tournament: Tournament): string[] {
  return standingsGroups(tournament.teams).map(g => g.group).filter(id => id !== OVERALL_GROUP);
}

/** Ein Abschnitt der Folie „Alle Tabellen / Finalrunde“: eine Gruppentabelle oder eine Seite der Finalrunde. */
export type StandingsSection = { kind: 'group'; groupId: string } | { kind: 'overall' } | { kind: 'finals'; matches: MatchView[] };

/**
 * Abschnitte je Seite (R-f3): je Gruppe eine Tabelle zuerst, danach die Finalrunde. Die Finalrunde blättert nach gemessener Höhe wie der
 * Spielplan (`listPages`, @ZM-185, „dichte Folien blättern statt die Schrift zu verkleinern“): jede Seite der Finalrunde (gleichmäßig verteilt, „2 + 2“) ist ein eigener
 * Abschnitt, also eine Seite der Folie – der Takt, „Seite x / y“ und die Seitendauer bleiben wie bei allen blätternden Folien. So wird
 * nie etwas abgeschnitten, und eine Tabelle springt nie, wenn die Finalrunde wächst (sie steht hinter den Tabellen).
 * Ohne Gruppen (Jeder gegen Jeden, Controller-Ruling B-16f3 Fixrunde 1): eine Gesamttabelle über alle Teams.
 */
export function standingsSections(tournament: Tournament, view: TournamentView, frame: ListFrame = DEFAULT_FRAME): StandingsSection[] {
  const ids = groupIds(tournament);
  const sections: StandingsSection[] = ids.map(groupId => ({ kind: 'group', groupId }));
  if (ids.length === 0 && tournament.teams.length > 0) { sections.push({ kind: 'overall' }); }
  const finals = finalRoundMatches(view);
  if (finals.length > 0) {
    for (const matches of listPagesBalanced(finals, finalColumns(view), undefined, frame)) { sections.push({ kind: 'finals', matches }); }
  }
  return sections;
}

/** Spalten der Finalrunde: wie im Spielplan mit reservierter Zustandszeile unter der Uhrzeit; die Bezeichnung steht als Zwischenzeile über der Zeilenkarte. */
export function finalColumns(view: TournamentView): ListColumns {
  return listColumns(true, false, view.matches);
}

/** Seiten und Spalten einer Listen-Folie: `pages[page]` sind die Zeilen der Seite, `columns` gelten für alle Seiten (@ZM-187). */
export interface ListLayout {
  pages: MatchView[][];
  columns: ListColumns;
}

/**
 * Startseite des Spielplans (@ZM-190): die Seite des laufenden Spiels, sonst die des nächsten geplanten; sind alle beendet (oder keins
 * offen), die erste. Die Seiten selbst bleiben in Anpfiff-Reihenfolge; die Folie hält den Versatz beim Eintritt fest (`useListenStart`),
 * damit sich eine Seite während des Zeigens nie auf andere Spiele ändert (@ZM-187).
 */
export function startPage(pages: readonly (readonly MatchView[])[]): number {
  const holds = (test: (m: MatchView) => boolean): number => pages.findIndex(page => page.some(test));
  const live = holds(m => m.isLive);
  return live >= 0 ? live : Math.max(0, holds(m => m.isUpcoming));
}

/** Der Rahmen einer Listen-Folie: wirksamer Bildrand; auf der Ersatzfolie, die den Wachhalten-Hinweis zeigen kann, ist sein Platz immer reserviert. */
export function listFrame(slide: ProgramSlide, overscan: number): ListFrame {
  return { overscan, notice: slide === SPIELPLAN_FALLBACK_SLIDE };
}

/** Spielplan eines Felds: alle Spiele des Felds, nach Höhe auf Seiten verteilt, höchstens `SCHEDULE_MAX_ROWS` je Seite (@ZM-185, @ZM-188). */
export function scheduleFieldLayout(view: TournamentView, field: number, frame: ListFrame = DEFAULT_FRAME): ListLayout {
  const schedule = fieldSchedule(view, field);
  const columns = listColumns(true, false, schedule);
  return { pages: listPages(schedule, columns, SCHEDULE_MAX_ROWS, frame), columns };
}

/** „Nächste Spiele“: die nächsten offenen Spiele, nach Höhe auf Seiten verteilt; jede Paarung auf genau einer Seite (@ZM-150, @ZM-188); bei mehreren Feldern mit dem Feld in jeder Zeile (@ZM-189). */
export function nextMatchesLayout(view: TournamentView, matchCount: number | undefined, frame: ListFrame = DEFAULT_FRAME): ListLayout {
  const list = nextMatchList(view, matchCount);
  const columns = listColumns(false, true, view.matches);
  return { pages: listPages(list, columns, undefined, frame), columns };
}

/**
 * Seitenzahl einer Folie für den Takt (B-16f1, f3). Alle Tabellen: ein Abschnitt je Seite. Spielplan und
 * Nächste Spiele: nach Höhe der Zeilen (`listRows.ts`). Andere Folien: eine Seite.
 */
export function monitorPageCount(slide: ProgramSlide, tournament?: Tournament | null, view?: TournamentView | null, end?: MonitorEnd, frame: ListFrame = DEFAULT_FRAME): number {
  // Folien nach dem Abschluss (R3-7, @ZM-129): Seiten aus dem gespeicherten Endstand, ohne Tabelle und Ansicht
  if (slide.type === 'final-standings') { return end?.kind === 'final' ? rankingPages(end.ranking).length : 1; }
  if (slide.type === 'final-scorers') { return end?.kind === 'final' && end.scorers !== null ? scorerPages(end.scorers).length : 1; }
  if (!tournament || !view || !('config' in slide)) { return 1; }
  switch (slide.type) {
    case 'all-standings':
      return Math.max(1, standingsSections(tournament, view, frame).length);
    case 'schedule-field':
      return scheduleFieldLayout(view, fieldIdToNumber(slide.config.fieldId), frame).pages.length;
    case 'next-matches':
      return nextMatchesLayout(view, slide.config.matchCount, frame).pages.length;
    default:
      return 1;
  }
}
