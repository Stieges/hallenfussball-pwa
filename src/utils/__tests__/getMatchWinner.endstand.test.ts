/**
 * A-36b Schritt 3, Auflage Tabelle (Brief A-36b): `getMatchWinner` bestimmt Sieger/Verlierer nur noch über den
 * zentralen Endstand `matchFinalScore` – kein eigenes Lesen von Verlängerung oder Strafstoßschießen.
 * `calculateStandings` bleibt bei der regulären Spielzeit (Gruppenspiele haben keine Verlängerung).
 */
import { describe, expect, it } from 'vitest';
import { calculateFinalsPlacement, calculateStandings, getMatchWinner, getMergedFinalRanking, placementRankText } from '../calculations';
import type { Match, Team } from '../../types/tournament';
import { resultOf, vs, testUuid } from '../../test/matchSlotFixtures';
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
    expect(rows(ranking).slice(4).map(([rank]) => rank)).toEqual(['5', '6']); // N-W1: keine Lücke hinter 3–4
  });
});

describe('@ET-042 Rangliste ohne Lücken bei Platzierungsspielen 5/7 (Nachreview N-W1, N-K3)', () => {
  // all-places: Halbfinals laufen, Spiele um Platz 5 und 7 sind schon besetzt (Gruppendritte/-vierte).
  const ids = [41, 42, 43, 44, 45, 46, 47, 48].map(testUuid);
  const [a1, a2, a3, a4, b1, b2, b3, b4] = ids;
  const teams: Team[] = ids.map((id, i) => ({ id, name: `Team ${i + 1}`, group: i < 4 ? 'A' : 'B' }));
  const tournament = createMockTournament({ teams });
  const groupTable = (): ReturnType<typeof calculateStandings> => teams.map((team) => calculateStandings([team], [], tournament)[0]);
  const ko = (id: string, extra: Partial<Match>): Match => ({ id, round: 9, field: 1, isFinal: true, ...vs(a1, b2), ...extra });
  const [HF1, HF2] = [testUuid(901), testUuid(902)];
  const halbfinals = [
    ko(HF1, { ...vs(a1, b2), matchStatus: 'running', scoreA: 1, scoreB: 0 }),
    ko(HF2, { ...vs(b1, a2), matchStatus: 'running', scoreA: 0, scoreB: 0 }),
  ];
  const finals = (decided: boolean): Match[] => [
    ko('f', { finalType: 'final', ...(decided ? { ...vs(a1, b1), matchStatus: 'finished', scoreA: 2, scoreB: 1, decidedBy: 'regular' } : { slotA: resultOf(HF1, 'winner'), slotB: resultOf(HF2, 'winner') }) }),
    ko('p3', { finalType: 'thirdPlace', ...(decided ? { ...vs(b2, a2), matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular' } : { slotA: resultOf(HF1, 'loser'), slotB: resultOf(HF2, 'loser') }) }),
    ko('p5', { finalType: 'fifthSixth', ...vs(a3, b3), ...(decided ? { matchStatus: 'finished', scoreA: 3, scoreB: 0, decidedBy: 'regular' } : {}) }),
    ko('p7', { finalType: 'seventhEighth', ...vs(a4, b4), ...(decided ? { matchStatus: 'finished', scoreA: 0, scoreB: 1, decidedBy: 'regular' } : {}) }),
  ];
  const rows = (ranking: ReturnType<typeof getMergedFinalRanking>['ranking']) =>
    ranking.map((p) => [placementRankText(p), p.team.id, p.decidedBy]);

  it('@ET-042 Halbfinals laufen, 5–6 und 7–8 offen → Halbfinalisten vorläufig auf 1–4, dann 5–6, 7–8, keine Plätze 9–12', () => {
    const { ranking } = getMergedFinalRanking(teams, [...halbfinals, ...finals(false)], groupTable(), tournament);
    expect(rows(ranking).slice(0, 4).map(([rank]) => rank)).toEqual(['1', '2', '3', '4']);
    expect(new Set(ranking.slice(0, 4).map((p) => p.team.id))).toEqual(new Set([a1, a2, b1, b2]));
    expect(rows(ranking).slice(4)).toEqual([
      ['5–6', a3, 'open'], ['5–6', b3, 'open'], ['7–8', a4, 'open'], ['7–8', b4, 'open'],
    ]);
    expect(Math.max(...ranking.map((p) => p.rankTo ?? p.rank))).toBe(8);
  });

  it('@ET-042 Gegenbeispiel: alles entschieden → Plätze 1 bis 8 lückenlos', () => {
    const { ranking } = getMergedFinalRanking(teams, [...halbfinals, ...finals(true)], groupTable(), tournament);
    expect(rows(ranking)).toEqual([
      ['1', a1, 'playoff'], ['2', b1, 'playoff'], ['3', b2, 'playoff'], ['4', a2, 'playoff'],
      ['5', a3, 'playoff'], ['6', b3, 'playoff'], ['7', b4, 'playoff'], ['8', a4, 'playoff'],
    ]);
  });

  it('@ET-042 N-K3: ein Team in zwei offenen Spielen (Datenfehler) erscheint nur einmal', () => {
    const doppelt = [ko('p5', { finalType: 'fifthSixth', ...vs(a3, b3) }), ko('p7', { finalType: 'seventhEighth', ...vs(a3, b4) })];
    const { ranking } = getMergedFinalRanking(teams, doppelt, groupTable(), tournament);
    expect(ranking.filter((p) => p.team.id === a3)).toHaveLength(1);
    expect(ranking).toHaveLength(teams.length);
  });
});

describe('@ET-042 F1-W1: Gruppen-Ausgeschiedene nach Gruppenplatz, Standings wie in der App (ohne Gruppe)', () => {
  // Gruppe A: alles Remis (je 3 Pkt), Reihenfolge über die Tore; Gruppe B: b1 9, b2 4, b3 2, b4 1 → A4 (3) > B3 (2).
  const ids = [61, 62, 63, 64, 65, 66, 67, 68].map(testUuid);
  const [a1, a2, a3, a4, b1, b2, b3, b4] = ids;
  const teams: Team[] = ids.map((id, i) => ({ id, name: `T${i + 1}`, group: i < 4 ? 'A' : 'B' }));
  let n = 0;
  const g = (group: string, x: string, y: string, sa: number, sb: number): Match => ({
    id: `g${++n}`, round: n, field: 1, ...vs(x, y), group, matchStatus: 'finished', scoreA: sa, scoreB: sb,
  });
  const groupMatches = [
    g('A', a1, a2, 3, 3), g('A', a1, a3, 3, 3), g('A', a1, a4, 2, 2), g('A', a2, a3, 2, 2), g('A', a2, a4, 2, 2), g('A', a3, a4, 1, 1),
    g('B', b1, b2, 1, 0), g('B', b1, b3, 1, 0), g('B', b1, b4, 1, 0), g('B', b2, b3, 0, 0), g('B', b2, b4, 1, 0), g('B', b3, b4, 0, 0),
  ];
  const finals: Match[] = [
    { id: 'f', round: 20, field: 1, ...vs(a1, b1), isFinal: true, finalType: 'final', matchStatus: 'finished', scoreA: 0, scoreB: 1, decidedBy: 'regular' },
    { id: 'p3', round: 19, field: 1, ...vs(b2, a2), isFinal: true, finalType: 'thirdPlace', matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular' },
  ];
  const appStandings = (matches: Match[]) => {
    const tournament = createMockTournament({ teams, matches, groupSystem: 'groupsAndFinals' });
    return { tournament, standings: calculateStandings(teams, matches, tournament) };
  };

  it('@ET-042 Finale entschieden: Plätze 5–8 = A3, B3, A4, B4 (A4 hat mehr Punkte als B3, steht trotzdem dahinter)', () => {
    const matches = [...groupMatches, ...finals];
    const { tournament, standings } = appStandings(matches);
    expect(standings.findIndex((s) => s.team.id === a4)).toBeLessThan(standings.findIndex((s) => s.team.id === b3)); // Ausgangslage
    const { ranking } = getMergedFinalRanking(teams, matches, standings, tournament);
    expect(ranking.map((p) => [p.rank, p.team.id])).toEqual([
      [1, b1], [2, a1], [3, b2], [4, a2], [5, a3], [6, b3], [7, a4], [8, b4],
    ]);
  });

  it('@ET-042 auch während der Gruppenphase: Erste, Zweite, Dritte, Vierte – A4 hinter B3', () => {
    const { tournament, standings } = appStandings(groupMatches);
    const { ranking } = getMergedFinalRanking(teams, groupMatches, standings, tournament);
    expect(ranking.map((p) => p.team.id)).toEqual([b1, a1, b2, a2, a3, b3, a4, b4]);
  });

  it('Gegenbeispiel Liga (ohne Gruppen): Reihenfolge der Ligatabelle bleibt', () => {
    const liga = teams.map((t) => ({ ...t, group: undefined }));
    const matches = groupMatches.map((m) => ({ ...m, group: undefined }));
    const tournament = createMockTournament({ teams: liga, matches, groupSystem: 'roundRobin' });
    const standings = calculateStandings(liga, matches, tournament);
    const { ranking } = getMergedFinalRanking(liga, matches, standings, tournament);
    expect(ranking.map((p) => p.team.id)).toEqual(standings.map((s) => s.team.id));
  });
});
