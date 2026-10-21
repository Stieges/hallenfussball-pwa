/**
 * A-25c – Nichtantritts-Wertung in der Tabelle (Plan GA4 v2 § 5 A-25c). Records `2026-09-27_wizard-regelinhalte`
 * (@W2A-022, @W2A-024, @W2A-025) und `2026-10-01_turniermodi` (@TM-063). Tests aus dem Gherkin; gelesen wird über die
 * Cloud-Zeile (`decided_by 'forfeit'`, `forfeit_absent`), wie sie nach Migration `20261110_005` aus `select('*')` kommt.
 *
 * Teilabdeckung (`:teil`): das Markieren selbst (Befehl, B-12, Engine A-25n), die Kennzeichnung in allen Ansichten
 * (B-14/B-15) und der Vorschlag „Gruppe abschließen“ (A-13) gehören zu anderen Aufgaben. Hier: Wertung, Tabelle,
 * Lesefunktionen `isForfeitMatch` und `forfeitResultFor`.
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings, getMatchWinner } from '../../../utils/calculations';
import { isGroupMatchDecided } from '../countsForStandings';
import { rankTournamentGroup } from '../tournamentTable';
import { DEFAULT_FORFEIT_SCORE, forfeitResultFor, isForfeitMatch } from '../../models/forfeit';
import { mapTournamentToSupabase } from '../../repositories/supabaseMappers';
import { TournamentSchema } from '../../models/schemas/TournamentSchema';
import type { ForfeitAbsent, Match, Standing, Team, Tournament } from '../../../types/tournament';
import { id, league, NAME, parseMatches, type Key } from './fixtures';
import { cloudTournament, game, matchIdOf, namedTeams } from './forfeitKit';

const table = (t: Tournament, group?: string): Standing[] => calculateStandings(t.teams, t.matches, t, group);
const rowOf = (rows: readonly Standing[], teamId: string): Standing => {
  const found = rows.find((r) => r.team.id === teamId);
  if (found === undefined) {
    throw new Error(`Team ${teamId} fehlt`);
  }
  return found;
};
const counts = (s: Standing) => ({
  played: s.played, won: s.won, drawn: s.drawn, lost: s.lost, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, points: s.points,
});
/** Was ein Spiel einem Team bringt: Zeile nachher minus Zeile vorher. */
const delta = (before: Standing, after: Standing) => {
  const b = counts(before);
  const a = counts(after);
  return {
    played: a.played - b.played, won: a.won - b.won, drawn: a.drawn - b.drawn, lost: a.lost - b.lost,
    goalsFor: a.goalsFor - b.goalsFor, goalsAgainst: a.goalsAgainst - b.goalsAgainst, points: a.points - b.points,
  };
};
const matchById = (t: Tournament, matchId: string): Match => {
  const found = t.matches.find((m) => m.id === matchId);
  if (found === undefined) {
    throw new Error(`Spiel ${matchId} fehlt`);
  }
  return found;
};

describe('A-25c Nichtantritt: Wertung in der Gesamttabelle', () => {
  const [teamC, teamD] = namedTeams(['Team C', 'Team D']);

  /** Spiel mit dem Stand, den die Markierung „nicht angetreten“ nach der Einstellung erzeugt (`forfeitResultFor`). */
  function markedForfeit(home: Team, away: Team, absent: ForfeitAbsent, settings: Pick<Tournament, 'forfeitScore'> = {}): Match {
    const { a, b } = forfeitResultFor(settings, absent);
    return game('m-cd', home, away, [a, b]);
  }

  it.each([
    { side: 'Heimseite', home: teamC, away: teamD, absent: 'A' as const, stored: [0, 2] },
    { side: 'Gastseite', home: teamD, away: teamC, absent: 'B' as const, stored: [2, 0] },
  ])('@W2A-022:teil Team C ($side) nicht angetreten: 2:0 und die Punkte eines Siegs für Team D, Team C 0 Punkte 0:2', ({ home, away, absent, stored }) => {
    const match = markedForfeit(home, away, absent);
    expect([match.scoreA, match.scoreB]).toEqual(stored);

    const t = cloudTournament([teamC, teamD], [match], { [match.id]: absent });
    const rows = table(t);

    expect(counts(rowOf(rows, teamD.id))).toEqual({ played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3 });
    expect(counts(rowOf(rows, teamC.id))).toEqual({ played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 });
    expect(rows.map((r) => r.team.name)).toEqual(['Team D', 'Team C']);
    // „als Wertung gekennzeichnet, nicht als gespieltes Ergebnis“: die Lesefunktion für alle Ansichten
    expect(isForfeitMatch(matchById(t, match.id))).toBe(true);
    expect(matchById(t, match.id).forfeitAbsent).toBe(absent);
  });

  it('@W2A-022:teil Gegenbeispiel: ein gespieltes 0:2 zählt gleich, ist aber keine Wertung', () => {
    const played = game('m-cd', teamC, teamD, [0, 2]);
    const t = cloudTournament([teamC, teamD], [played]);
    expect(counts(rowOf(table(t), teamD.id)).points).toBe(3);
    expect(isForfeitMatch(matchById(t, played.id))).toBe(false);
    expect(matchById(t, played.id).forfeitAbsent).toBeUndefined();
  });

  describe('beide Teams nicht angetreten', () => {
    const teams = namedTeams(['Team A', 'Team B', 'Team C', 'Team D'], 'A');
    const [a, b, c, d] = teams;
    const others = [
      game('g-1', a, b, [1, 0], 'A'), game('g-2', a, c, [2, 1], 'A'), game('g-3', b, d, [1, 1], 'A'),
      game('g-4', a, d, [0, 3], 'A'), game('g-5', b, c, [2, 2], 'A'),
    ];

    it('@W2A-024:teil Team C und Team D treten beide nicht an (Wertung 2:0): je 0 Punkte und je 0:2 Tore, kein Sieg, das Spiel ist entschieden', () => {
      const before = cloudTournament(teams, [...others, game('g-6', c, d, undefined, 'A')]);
      const both = markedForfeit(c, d, 'both');
      const after = cloudTournament(teams, [...others, { ...both, id: 'g-6', group: 'A' }], { 'g-6': 'both' });
      const zero = { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 };

      expect([both.scoreA, both.scoreB]).toEqual([0, 0]);
      expect(delta(rowOf(table(before, 'A'), c.id), rowOf(table(after, 'A'), c.id))).toEqual(zero);
      expect(delta(rowOf(table(before, 'A'), d.id), rowOf(table(after, 'A'), d.id))).toEqual(zero);
      expect(getMatchWinner(matchById(after, 'g-6'))).toBeNull();
      expect(isGroupMatchDecided(matchById(after, 'g-6'))).toBe(true);
      expect(rankTournamentGroup(before, 'A').allGroupMatchesDecided).toBe(false);
      expect(rankTournamentGroup(after, 'A').allGroupMatchesDecided).toBe(true);
      expect(isForfeitMatch(matchById(after, 'g-6'))).toBe(true);
    });

    it('@W2A-024:teil Gegenbeispiel: ein gespieltes 0:0 bleibt ein Remis (je 1 Punkt, keine Gegentore)', () => {
      const before = cloudTournament(teams, [...others, game('g-6', c, d, undefined, 'A')]);
      const after = cloudTournament(teams, [...others, game('g-6', c, d, [0, 0], 'A')]);
      const draw = { played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 1 };
      expect(delta(rowOf(table(before, 'A'), c.id), rowOf(table(after, 'A'), c.id))).toEqual(draw);
      expect(delta(rowOf(table(before, 'A'), d.id), rowOf(table(after, 'A'), d.id))).toEqual(draw);
      expect(isForfeitMatch(matchById(after, 'g-6'))).toBe(false);
    });

    it('Gegenbeispiel: Wertung beider Seiten mit gespeichertem Stand ungleich 0:0 – weder Tabelle noch Sieger-Regel geben einen Sieg', () => {
      const before = cloudTournament(teams, [...others, game('g-6', c, d, undefined, 'A')]);
      const after = cloudTournament(teams, [...others, game('g-6', c, d, [1, 0], 'A')], { 'g-6': 'both' });
      for (const team of [c, d]) {
        expect(delta(rowOf(table(before, 'A'), team.id), rowOf(table(after, 'A'), team.id)), team.name)
          .toEqual({ played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 });
      }
      expect(getMatchWinner(matchById(after, 'g-6'))).toBeNull();
    });

    it('Gegenbeispiel: nach einer Korrektur (Entscheidungsart nicht mehr „Wertung“) zählt das korrigierte Ergebnis, auch wenn forfeitAbsent noch aus der Zeile stammt', () => {
      const after = cloudTournament(teams, [...others, game('g-6', c, d, [0, 0], 'A')], { 'g-6': 'both' });
      // Engine-Überlagerung nach einer Korrektur 1:1: Stand und Entscheidungsart neu, die Zeile ist noch nicht nachgeladen.
      const corrected: Tournament = {
        ...after,
        matches: after.matches.map((m) => (m.id === 'g-6' ? { ...m, scoreA: 1, scoreB: 1, decidedBy: 'regular' as const } : m)),
      };
      expect(matchById(corrected, 'g-6').forfeitAbsent).toBe('both');
      expect(counts(rowOf(table(corrected, 'A'), c.id))).toMatchObject({ drawn: 2, lost: 1 });
      expect(isForfeitMatch(matchById(corrected, 'g-6'))).toBe(false);
    });
  });

  it('@TM-063:teil Gruppe A 5 von 6 entschieden, TSV West – SC Ost beide nicht angetreten: entschieden, je 0 Punkte und je 0:2 Tore, als Wertung gekennzeichnet', () => {
    const results = 'N–B 2:1; N–W 1:0; N–O 3:0; B–W 2:2; B–O 1:1; W–O 0:0';
    const westOst = matchIdOf(results, 'W–O');
    const { teams } = league('NBWO', results, { group: 'A' });
    const before = cloudTournament(teams, parseMatches(results, { group: 'A', open: ['W–O'] }));
    const after = cloudTournament(teams, parseMatches(results, { group: 'A' }), { [westOst]: 'both' });
    const zero = { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 };

    expect(rankTournamentGroup(before, 'A').allGroupMatchesDecided).toBe(false);
    expect(rankTournamentGroup(after, 'A').allGroupMatchesDecided).toBe(true);
    for (const key of ['W', 'O'] as Key[]) {
      expect(delta(rowOf(table(before, 'A'), id(key)), rowOf(table(after, 'A'), id(key))), NAME[key]).toEqual(zero);
    }
    expect(isForfeitMatch(matchById(after, westOst))).toBe(true);
    expect(getMatchWinner(matchById(after, westOst))).toBeNull();
  });
});

describe('A-25c Wertung einstellbar (tournament.forfeitScore im config)', () => {
  it('@W2A-025:teil die Turnierleitung stellt die Wertung auf 3:0: ein Nichtantritt lautet 3:0 bzw. 0:3', () => {
    const t = cloudTournament([], [], {}, { forfeitScore: { winner: 3, loser: 0 } });
    expect(t.forfeitScore).toEqual({ winner: 3, loser: 0 });
    expect(forfeitResultFor(t, 'B')).toEqual({ a: 3, b: 0 });
    expect(forfeitResultFor(t, 'A')).toEqual({ a: 0, b: 3 });
    // beide fehlen: gespeichert 0:0 (Regel der Engine), die Gegentore setzt die Tabelle
    expect(forfeitResultFor(t, 'both')).toEqual({ a: 0, b: 0 });
  });

  it('@W2A-025:teil bei 3:0 erhalten zwei nicht angetretene Teams je 0:3 Tore', () => {
    const results = 'N–B 2:1; N–W 1:0; N–O 3:0; B–W 2:2; B–O 1:1; W–O 0:0';
    const { teams } = league('NBWO', results, { group: 'A' });
    const before = cloudTournament(teams, parseMatches(results, { group: 'A', open: ['W–O'] }), {}, { forfeitScore: { winner: 3, loser: 0 } });
    const after = cloudTournament(teams, parseMatches(results, { group: 'A' }), { [matchIdOf(results, 'W–O')]: 'both' }, { forfeitScore: { winner: 3, loser: 0 } });
    expect(delta(rowOf(table(before, 'A'), id('W')), rowOf(table(after, 'A'), id('W')))).toMatchObject({ goalsFor: 0, goalsAgainst: 3, points: 0 });
    expect(delta(rowOf(table(before, 'A'), id('O')), rowOf(table(after, 'A'), id('O')))).toMatchObject({ goalsFor: 0, goalsAgainst: 3, points: 0 });
  });

  it('@W2A-025:teil ohne Einstellung gilt 2:0', () => {
    const t = cloudTournament([], []);
    expect(t.forfeitScore).toBeUndefined();
    expect(DEFAULT_FORFEIT_SCORE).toEqual({ winner: 2, loser: 0 });
    expect(forfeitResultFor(t, 'B')).toEqual({ a: 2, b: 0 });
  });

  it.each([
    { name: 'kein Sieger (2:2)', value: { winner: 2, loser: 2 } },
    { name: 'negativ', value: { winner: 2, loser: -1 } },
    { name: 'keine ganze Zahl', value: { winner: 1.5, loser: 0 } },
    { name: 'Text', value: 'drei zu null' },
    { name: 'fremdes Feld', value: { winner: 3, loser: 0, reason: 'x' } },
  ])('Gegenbeispiel: eine unbrauchbare Einstellung ($name) gilt nicht, es bleibt 2:0', ({ value }) => {
    const t = cloudTournament([], [], {}, { forfeitScore: value });
    expect(t.forfeitScore).toBeUndefined();
    expect(forfeitResultFor(t, 'A')).toEqual({ a: 0, b: 2 });
  });

  it('die Einstellung übersteht Speichern in die Cloud und das lokale Laden', () => {
    const t = cloudTournament([], [], {}, { forfeitScore: { winner: 3, loser: 0 }, sportId: 'football-indoor' });
    const { tournamentRow } = mapTournamentToSupabase(t, 'owner-1');
    expect((tournamentRow.config as { forfeitScore?: unknown }).forfeitScore).toEqual({ winner: 3, loser: 0 });

    const local = TournamentSchema.parse(JSON.parse(JSON.stringify(t)));
    expect(local.forfeitScore).toEqual({ winner: 3, loser: 0 });
    const broken = TournamentSchema.parse({ ...(JSON.parse(JSON.stringify(t)) as object), forfeitScore: { winner: 1, loser: 1 } });
    expect(broken.forfeitScore).toBeUndefined();
  });

  it('Gegenbeispiel: ohne Einstellung schreibt das Speichern kein forfeitScore ins config', () => {
    const { tournamentRow } = mapTournamentToSupabase(cloudTournament([], []), 'owner-1');
    expect(Object.keys(tournamentRow.config as object)).not.toContain('forfeitScore');
  });
});
