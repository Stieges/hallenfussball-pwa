/**
 * Testdaten und Hilfen für das Endstand-PDF (Gestaltungspaket @DR-051, @DR-052, @DR-054). Dieselben Daten wie das freigegebene
 * Mockup (`mockups/endstand-pdf-gestaltung/bauen.mjs`): „Hallencup Nord“ mit 8 Teams, Finalrunde mit Strafstoßschießen und
 * Verlängerung und Torschützen als Zusatzfall; „Nikolausturnier“ mit 6 Teams in einer Gruppe ohne Torschützen. Nur Tests.
 */
import { generateFullSchedule, type GeneratedSchedule, type ScheduledMatch } from '../../../core/generators';
import type { ScorerRow } from '../../../core/standings/finalStandings/types';
import type { TeamId } from '../../../core/models/schemas/MatchSlotSchema';
import type { Match, Standing, Team, Tournament } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';
import { buildSchedulePdf, type PDFExportOptions } from '../schedulePdf';
import type { RankEntry } from '../placement';
import { withTournamentState } from '../tournamentState';
import { HALLENCUP_ID, HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { readLayout, type LayoutPage, type LayoutText } from './pdfjsLayout';
import { translatorFor } from './pdfText';

export const ABSCHLUSS = new Date('2026-11-28T12:30:00');

const row = (team: Team, won: number, drawn: number, lost: number, goalsFor: number, goalsAgainst: number): Standing => ({
  team, played: won + drawn + lost, won, drawn, lost, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst, points: won * 3 + drawn,
});
const byId = (id: string): Team => HALLENCUP_TEAMS.find(t => t.id === id)!;

/** Tabellen wie im Mockup (Gruppe A: Nord, Süd, Berg, Tal; Gruppe B: West, Hof, Ost, Mitte). */
export const HALLENCUP_TABELLEN: Standing[] = [
  row(byId(HALLENCUP_ID.nord), 2, 1, 0, 3, 0), row(byId(HALLENCUP_ID.sued), 1, 2, 0, 2, 1),
  row(byId(HALLENCUP_ID.berg), 1, 0, 2, 2, 4), row(byId(HALLENCUP_ID.tal), 0, 1, 2, 2, 4),
  row(byId(HALLENCUP_ID.west), 2, 0, 1, 4, 2), row(byId(HALLENCUP_ID.hof), 1, 1, 1, 3, 3),
  row(byId(HALLENCUP_ID.ost), 1, 1, 1, 1, 2), row(byId(HALLENCUP_ID.mitte), 0, 2, 1, 1, 2),
];

/** Endstand des Hallencups laut Mockup: Nord, West, Ost, Süd, Berg, Mitte, Tal, Hof. */
export const HALLENCUP_PLAETZE: RankEntry[] = [HALLENCUP_ID.nord, HALLENCUP_ID.west, HALLENCUP_ID.ost, HALLENCUP_ID.sued, HALLENCUP_ID.berg, HALLENCUP_ID.mitte, HALLENCUP_ID.tal, HALLENCUP_ID.hof]
  .map((id, i) => ({ place: i + 1, team: byId(id) }));

const player = (rank: number, number: number, id: string, goals: number): ScorerRow => ({ kind: 'player', rank, teamId: id as TeamId, teamName: byId(id).name, number, goals });
/** Torschützen wie im Mockup: 16 Spieler, geteilte Ränge 1, 3 und 9; dazu 2 Tore ohne Rückennummer und 1 Eigentor. */
export const HALLENCUP_SCHUETZEN: ScorerRow[] = [
  player(1, 10, HALLENCUP_ID.nord, 3), player(1, 9, HALLENCUP_ID.west, 3),
  player(3, 8, HALLENCUP_ID.nord, 2), player(3, 7, HALLENCUP_ID.ost, 2), player(3, 11, HALLENCUP_ID.ost, 2),
  player(3, 9, HALLENCUP_ID.hof, 2), player(3, 10, HALLENCUP_ID.sued, 2), player(3, 7, HALLENCUP_ID.west, 2),
  player(9, 6, HALLENCUP_ID.berg, 1), player(9, 14, HALLENCUP_ID.berg, 1), player(9, 12, HALLENCUP_ID.mitte, 1), player(9, 4, HALLENCUP_ID.nord, 1),
  player(9, 5, HALLENCUP_ID.hof, 1), player(9, 11, HALLENCUP_ID.west, 1), player(9, 3, HALLENCUP_ID.tal, 1), player(9, 8, HALLENCUP_ID.tal, 1),
  { kind: 'noNumber', rank: null, teamId: HALLENCUP_ID.nord as TeamId, teamName: 'FC Nord', goals: 2 },
  { kind: 'ownGoals', rank: null, teamId: HALLENCUP_ID.ost as TeamId, teamName: 'SC Ost', goals: 1 },
];

/** Gruppenspiele des Mockups je Paar (Heim, Gast, Tore): ergeben genau die Tabellen oben. */
const GRUPPENSPIELE: Array<[string, string, number, number]> = [
  ['FC Nord', 'SV Süd', 0, 0], ['FC Nord', 'DJK Berg', 2, 0], ['FC Nord', 'TuS Tal', 1, 0], ['SV Süd', 'DJK Berg', 1, 0], ['SV Süd', 'TuS Tal', 1, 1], ['DJK Berg', 'TuS Tal', 2, 1],
  ['TSV West', 'SV Hof', 1, 2], ['TSV West', 'SC Ost', 2, 0], ['TSV West', 'FC Mitte', 1, 0], ['SV Hof', 'SC Ost', 0, 1], ['SV Hof', 'FC Mitte', 1, 1], ['SC Ost', 'FC Mitte', 0, 0],
];

/** Finalrunde mit Teams und Ergebnissen: Halbfinale 13 endet 1:1 und 4:3 im Strafstoßschießen, das Finale 1:1 und 1:0 in der Verlängerung. */
const FINALSPIELE: Record<number, Partial<Match> & { teams: [string, string]; time: string }> = {
  13: { time: '14:10', teams: ['FC Nord', 'SC Ost'], scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' },
  14: { time: '14:10', teams: ['TSV West', 'SV Süd'], scoreA: 2, scoreB: 0, decidedBy: 'regular' },
  15: { time: '14:20', teams: ['SC Ost', 'SV Süd'], scoreA: 3, scoreB: 1, decidedBy: 'regular' },
  16: { time: '14:30', teams: ['FC Nord', 'TSV West'], scoreA: 1, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' },
};

function besetzt(nummer: number, home: string, away: string, time: string): (m: ScheduledMatch) => ScheduledMatch {
  return m => (m.matchNumber === nummer ? { ...m, homeTeam: home, awayTeam: away, time } : m);
}

export interface EndstandFall {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  standings: Standing[];
  ranking: RankEntry[];
  scorers: ScorerRow[];
}

/** Der abgeschlossene Hallencup Nord mit allen Ergebnissen; `scorers` wahlweise leer. */
export function endstandHallencup(overrides: Partial<Tournament> = {}, scorers: ScorerRow[] = HALLENCUP_SCHUETZEN, finale: Partial<Match> = {}): EndstandFall {
  const base = hallencupTournament({ lifecycleStatus: 'finished', ...overrides });
  let schedule = hallencupSchedule(base);
  const matches: Match[] = [];
  const mirror = (m: ScheduledMatch, extra: Partial<Match>): void => {
    matches.push({ id: m.id, round: 0, field: m.field, slotA: m.slotA, slotB: m.slotB, originA: m.originA, originB: m.originB, group: m.group, phase: m.phase, matchNumber: m.matchNumber, matchStatus: 'finished', ...extra });
  };
  for (const [home, away, a, b] of GRUPPENSPIELE) {
    const found = schedule.allMatches.find(m => m.phase === 'groupStage' && [m.homeTeam, m.awayTeam].sort().join() === [home, away].sort().join());
    if (!found) { throw new Error(`Gruppenspiel ${home} – ${away} fehlt`); }
    const gedreht = found.homeTeam !== home;
    mirror(found, { scoreA: gedreht ? b : a, scoreB: gedreht ? a : b });
  }
  for (const [nummer, { teams, time, ...rest }] of Object.entries(FINALSPIELE).map(([n, f]) => [n, n === '16' ? { ...f, ...finale } : f] as const)) {
    const patch = besetzt(Number(nummer), teams[0], teams[1], time);
    schedule = { ...schedule, allMatches: schedule.allMatches.map(patch), phases: schedule.phases.map(p => ({ ...p, matches: p.matches.map(patch) })) };
    const found = schedule.allMatches.find(m => m.matchNumber === Number(nummer))!;
    mirror(found, rest);
  }
  const tournament = { ...base, matches };
  return { tournament, schedule: withTournamentState(schedule, tournament), standings: HALLENCUP_TABELLEN, ranking: HALLENCUP_PLAETZE, scorers };
}

const NIKOLAUS_NAMEN = ['DJK Kammer', 'TSV Waging rot', 'DJK Otting', 'TSV Petting', 'TSV 1921 Fridolfing', 'TSV Waging blau'];
const nikoSchuetze = (rank: number, index: number, number: number, goals: number): ScorerRow =>
  ({ kind: 'player', rank, teamId: testUuid(200 + index) as TeamId, teamName: NIKOLAUS_NAMEN[index], number, goals });
/** Torschützen im Stil des E2E-Seeds: Spieler der Vereine, deren Namen auch in der Platzliste stehen (Gleichstand auf Rang 2, Sammelzeilen). */
export const NIKOLAUS_SCHUETZEN: ScorerRow[] = [
  nikoSchuetze(1, 0, 9, 4), nikoSchuetze(2, 1, 7, 3), nikoSchuetze(2, 2, 10, 3), nikoSchuetze(4, 1, 11, 2),
  { kind: 'noNumber', rank: null, teamId: testUuid(200) as TeamId, teamName: NIKOLAUS_NAMEN[0], goals: 1 },
  { kind: 'ownGoals', rank: null, teamId: testUuid(203) as TeamId, teamName: NIKOLAUS_NAMEN[3], goals: 1 },
];
const NIKOLAUS_WERTE: Array<[number, number, number, number, number]> = [[5, 0, 0, 7, 0], [4, 0, 1, 6, 1], [3, 0, 2, 6, 4], [2, 0, 3, 2, 4], [1, 0, 4, 2, 6], [0, 0, 5, 0, 8]];

/**
 * Das abgeschlossene Nikolausturnier des Mockups: 6 Teams in einer Gruppe, keine Finalrunde. Vorgabe: OHNE Torschützen (so zeigt es das Mockup);
 * der Seed des Cloud-Durchstichs (N8) hat dagegen Tore mit Rückennummer – dafür `scorers` übergeben (`NIKOLAUS_SCHUETZEN`).
 */
export function endstandNikolaus(overrides: Partial<Tournament> = {}, scorers: ScorerRow[] = []): EndstandFall {
  const teams: Team[] = NIKOLAUS_NAMEN.map((name, i) => ({ id: testUuid(200 + i), name, group: undefined }));
  const tournament = hallencupTournament({
    title: 'Nikolausturnier', ageClass: 'F2-Junioren', date: '2026-11-28', teams, numberOfTeams: teams.length, groupSystem: 'roundRobin',
    numberOfGroups: 1, numberOfFields: 1, shareCode: 'NIKO26', lifecycleStatus: 'finished', ...overrides,
  });
  return {
    tournament,
    schedule: generateFullSchedule(tournament, 'de'),
    standings: teams.map((team, i) => row(team, ...NIKOLAUS_WERTE[i])),
    ranking: teams.map((team, i) => ({ place: i + 1, team })),
    scorers,
  };
}

/** Das Endstand-PDF eines Falls als Dokument und gelesene Seiten. */
export async function endstandPdf(fall: EndstandFall, options: Partial<PDFExportOptions> = {}) {
  const { doc } = await buildSchedulePdf({
    schedule: fall.schedule,
    standings: fall.standings,
    options: {
      locale: 'de', translate: translatorFor('de'), tournament: fall.tournament, viewerBaseUrl: 'https://hallenfussball.example', includeScores: true, includeStandings: true,
      edition: 'final', closed: true, closedAt: ABSCHLUSS, ranking: fall.ranking, scorers: fall.scorers, ...options,
    },
  });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return { doc, bytes, pages: await readLayout(bytes) };
}

/** Seiten des Endstand-PDFs. */
export async function endstandPages(fall: EndstandFall, options: Partial<PDFExportOptions> = {}): Promise<LayoutPage[]> {
  return (await endstandPdf(fall, options)).pages;
}

/** Seite, auf der ein Textstück (getrimmt, ohne führende Nummer) steht; -1, wenn es fehlt. */
export function seiteMit(pages: LayoutPage[], text: string): number {
  return pages.findIndex(p => p.texts.some(t => t.str.trim() === text));
}

/** Kennung der fetten Schrift einer Seite: der Titel im Kopf ist immer fett (die eingebetteten Schnitte tragen denselben Namen, `bold` trifft sie nicht). */
export function fettSchrift(page: LayoutPage): string {
  return page.texts[0].font;
}
/** Ist das Textstück fett gesetzt (gleiche Schrift wie der Titel der Seite)? */
export const istFett = (page: LayoutPage, text: LayoutText): boolean => text.font === fettSchrift(page);
