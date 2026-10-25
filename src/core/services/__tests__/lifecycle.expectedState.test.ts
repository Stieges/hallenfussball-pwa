/**
 * R3-2b Stand-Vergleich beim Turnierabschluss (A-21a-C1, R-EA-14, Plan R3 E4; @LZ-029): TS-Zwilling `expectedTournamentState`
 * == `match_engine.tournament_state`. Die Erwartung in `tournament-state.json` erzeugte die SQL-Regel im Wegwerf-Container
 * (scripts/tournament-lifecycle-check.sh, Kategorie G); die Turniere sind die echt erzeugten aus `group-state.json`, über den
 * Lese-Mapper (derselbe Weg wie beim Laden aus der Cloud) – nicht von Hand gebaut.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../../standings/__fixtures__/tournament-state.json';
import { tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
import type { GeneratedTournamentKey } from '../../../test/groupCompletionRows';
import { expectedTournamentState, sameTournamentState, type TournamentMatchState } from '../lifecycle';

describe('R3-2b Gleichlauf tournament-state.json (expectedTournamentState == match_engine.tournament_state)', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const t = tournamentFromFixture(c.tournament as GeneratedTournamentKey, { results: c.withResults, extraUpdates: c.extraUpdates });
      expect(expectedTournamentState(t)).toEqual(c.expected);
    });
  }

  it('die Fixture deckt Verlängerung, Strafstoßschießen und Wertung ab (oa/ob, pa/pb, f)', () => {
    const keys = new Set(fixture.cases.flatMap((c) => c.expected.flatMap((row) => Object.keys(row))));
    expect([...keys].sort()).toEqual(['a', 'b', 'f', 'id', 'oa', 'ob', 'pa', 'pb', 's', 'ta', 'tb']);
  });
});

describe('R3-2b sameTournamentState: lokaler Stand ↔ bestätigter Serverstand (E4)', () => {
  const server = fixture.cases[1].expected as TournamentMatchState[];

  it('gleicher Stand in anderer Reihenfolge der Spiele und Schlüssel gilt als gleich', () => {
    const umgestellt = [...server].reverse().map((row) => Object.fromEntries(Object.entries(row).reverse()) as unknown as TournamentMatchState);
    expect(sameTournamentState(umgestellt, server)).toBe(true);
  });

  it('Gegenbeispiel @LZ-029: ein Tor mehr in einem Spiel ist ein anderer Stand', () => {
    const geaendert = server.map((row, i) => (i === 0 ? { ...row, a: (row.a ?? 0) + 1 } : row));
    expect(sameTournamentState(geaendert, server)).toBe(false);
  });

  it('Gegenbeispiel: ein fehlendes Spiel ist ein anderer Stand', () => {
    expect(sameTournamentState(server.slice(1), server)).toBe(false);
  });
});
