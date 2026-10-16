/**
 * A-36b Schritt 3, Auflage Tabelle (Brief A-36b): `getMatchWinner` bestimmt Sieger/Verlierer nur noch über den
 * zentralen Endstand `matchFinalScore` – kein eigenes Lesen von Verlängerung oder Strafstoßschießen.
 * `calculateStandings` bleibt bei der regulären Spielzeit (Gruppenspiele haben keine Verlängerung).
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings, getMatchWinner } from '../calculations';
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

describe('@ET-013 calculateStandings bleibt bei der regulären Spielzeit (Gruppenspiele)', () => {
  it('@ET-013 Verlängerungs- und Strafstoß-Felder an einem Gruppenspiel ändern Tore und Punkte nicht', () => {
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
