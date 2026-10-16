/**
 * A-36b Schritt 3, Auflage Tabelle (Brief A-36b): `getMatchWinner` bestimmt Sieger/Verlierer nur noch über den
 * zentralen Endstand `matchFinalScore` – kein eigenes Lesen von Verlängerung oder Strafstoßschießen.
 * `calculateStandings` bleibt bei der regulären Spielzeit (Gruppenspiele haben keine Verlängerung).
 */
import { describe, expect, it } from 'vitest';
import { calculateFinalsPlacement, calculateStandings, getMatchWinner, getMergedFinalRanking, placementRankText } from '../calculations';
import type { Match, Team } from '../../types/tournament';
import { vs, testUuid } from '../../test/matchSlotFixtures';
import { createMockTournament } from '../../test/factories';

const [BERG, SUED] = [21, 22].map(testUuid);
const third = (extra: Partial<Match>): Match => ({
  id: 'platz3', round: 9, field: 1, ...vs(BERG, SUED), isFinal: true, finalType: 'thirdPlace', matchStatus: 'finished', ...extra,
});

describe('@ET-002 getMatchWinner über den zentralen Endstand', () => {
  it.each<[string, Partial<Match>, string, string]>([
    ['2:0 nach der regulären Spielzeit', { scoreA: 2, scoreB: 0, decidedBy: 'regular' }, BERG, SUED],
    ['1:1, 1:2 nach Verlängerung', { scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 1, decidedBy: 'overtime' }, SUED, BERG],
    [
      '1:1 n. V., 4:3 für DJK Berg im Strafstoßschießen',
      { scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 0, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' },
      BERG, SUED,
    ],
  ])('@ET-002 Spiel um Platz 3 %s', (_verlauf, extra, winner, loser) => {
    expect(getMatchWinner(third(extra))).toEqual({ winner, loser });
  });

  it('@ET-002 Gegenbeispiel: laufendes Spiel hat noch keinen Sieger, auch bei Führung', () => {
    expect(getMatchWinner(third({ matchStatus: 'running', scoreA: 2, scoreB: 0 }))).toBeNull();
  });

  it('@ET-013 Gegenbeispiel: Strafstoß ohne decidedBy penalty entscheidet nicht', () => {
    expect(getMatchWinner(third({ scoreA: 1, scoreB: 1, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'regular' }))).toBeNull();
  });

  it('@ET-013 Gegenbeispiel: gleicher Strafstoß-Stand trotz decidedBy penalty → kein Sieger (vorher: Gast)', () => {
    expect(getMatchWinner(third({ scoreA: 1, scoreB: 1, penaltyScoreA: 3, penaltyScoreB: 3, decidedBy: 'penalty' }))).toBeNull();
  });
});

// K2 (Review A-36b): keine @ET-013-Kennung – @ET-013 verlangt für die Verlierer derselben K.-o.-Runde Tore inkl.
// Verlängerung (matchFinalScore().a/b, Endstand-Paket); hier steht nur die Gruppenregel.
describe('Auflage Tabelle (Brief A-36b): Gruppenspiele nur reguläre Zeit', () => {
  it('Verlängerungs- und Strafstoß-Felder an einem Gruppenspiel ändern Tore und Punkte nicht', () => {
    const teams: Team[] = [{ id: BERG, name: 'DJK Berg', group: 'A' }, { id: SUED, name: 'SV Süd', group: 'A' }];
    const match: Match = {
      id: 'g1', round: 1, field: 1, ...vs(BERG, SUED), group: 'A', matchStatus: 'finished',
      scoreA: 1, scoreB: 1, overtimeScoreA: 2, overtimeScoreB: 0, penaltyScoreA: 4, penaltyScoreB: 3,
    };
    const tournament = createMockTournament({ teams, matches: [match] });
    const standings = calculateStandings(teams, [match], tournament, 'A');
    const berg = standings.find((s) => s.team.id === BERG);
    expect(berg).toMatchObject({ goalsFor: 1, goalsAgainst: 1, points: 1, drawn: 1 });
  });
});

describe('@ET-002 Platzierung: abgeschlossen heißt entschieden (Fixrunde W1)', () => {
  const [NORD, MITTE, WEST, OST] = [31, 32, 33, 34].map(testUuid);
  const teams: Team[] = [
    { id: NORD, name: 'FC Nord', group: 'A' }, { id: MITTE, name: 'SG Mitte', group: 'B' },
    { id: BERG, name: 'DJK Berg', group: 'A' }, { id: SUED, name: 'SV Süd', group: 'B' },
    { id: WEST, name: 'TSV West', group: 'A' }, { id: OST, name: 'SC Ost', group: 'B' },
  ];
  const finale = (extra: Partial<Match>): Match => ({
    id: 'finale', round: 10, field: 1, ...vs(NORD, MITTE), isFinal: true, finalType: 'final', ...extra,
  });
  const platz3 = third({ scoreA: 2, scoreB: 0, decidedBy: 'regular' });
  const tournament = createMockTournament({ teams });
  const groupTable = (): ReturnType<typeof calculateStandings> =>
    teams.map((team) => calculateStandings([team], [], tournament)[0]);

  it('@ET-002 laufendes Finale mit Führung 2:0 ist nicht abgeschlossen', () => {
    const result = calculateFinalsPlacement(teams, [finale({ matchStatus: 'running', scoreA: 2, scoreB: 0 }), platz3], []);
    expect(result).toMatchObject({ playoffStatus: 'in-progress', allFinalsCompleted: false, completedFinalsCount: 1 });
    expect(result.placements.map((p) => p.rank)).toEqual([3, 4]);
  });

  it('@ET-002 Finale 2:2 ohne Entscheidung ist nicht abgeschlossen', () => {
    const result = calculateFinalsPlacement(teams, [finale({ matchStatus: 'finished', scoreA: 2, scoreB: 2 }), platz3], []);
    expect(result).toMatchObject({ playoffStatus: 'in-progress', allFinalsCompleted: false });
  });

  it('@ET-002 Gegenbeispiel: entschiedenes Finale ist abgeschlossen, Finalisten auf 1 und 2', () => {
    const matches = [finale({ matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'regular' }), platz3];
    const result = calculateFinalsPlacement(teams, matches, []);
    expect(result).toMatchObject({ playoffStatus: 'completed', allFinalsCompleted: true });
    const { ranking } = getMergedFinalRanking(teams, matches, groupTable(), tournament);
    expect(ranking.slice(0, 4).map((p) => [p.rank, p.team.id])).toEqual([[1, NORD], [2, MITTE], [3, BERG], [4, SUED]]);
  });

  const rows = (ranking: ReturnType<typeof getMergedFinalRanking>['ranking']) =>
    ranking.map((p) => [placementRankText(p), p.team.id, p.decidedBy]);

  it('@ET-042 laufendes Finale 2:0: beide Finalisten vorläufig gemeinsam auf 1–2 „offen“, nie hinter den Gruppenplätzen', () => {
    const matches = [finale({ matchStatus: 'running', scoreA: 2, scoreB: 0 }), platz3];
    const { ranking } = getMergedFinalRanking(teams, matches, groupTable(), tournament);
    expect(rows(ranking).slice(0, 4)).toEqual([
      ['1–2', NORD, 'open'], ['1–2', MITTE, 'open'], ['3', BERG, 'playoff'], ['4', SUED, 'playoff'],
    ]);
    expect(rows(ranking).slice(4).map(([rank]) => rank)).toEqual(['5', '6']);
  });

  it('@ET-042 Gegenbeispiel: entschiedenes Finale → feste Plätze 1 und 2, nichts „offen“', () => {
    const matches = [finale({ matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'regular' }), platz3];
    const { ranking } = getMergedFinalRanking(teams, matches, groupTable(), tournament);
    expect(rows(ranking).slice(0, 2)).toEqual([['1', NORD, 'playoff'], ['2', MITTE, 'playoff']]);
    expect(ranking.some((p) => p.decidedBy === 'open')).toBe(false);
  });

  it('@ET-042 Spiel um Platz 3 offen, Finale entschieden → Plätze 3–4 gemeinsam „offen“', () => {
    const matches = [
      finale({ matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular' }),
      third({ matchStatus: 'running', scoreA: 1, scoreB: 1 }),
    ];
    const { ranking } = getMergedFinalRanking(teams, matches, groupTable(), tournament);
    expect(rows(ranking).slice(0, 4)).toEqual([
      ['1', NORD, 'playoff'], ['2', MITTE, 'playoff'], ['3–4', BERG, 'open'], ['3–4', SUED, 'open'],
    ]);
  });
});
