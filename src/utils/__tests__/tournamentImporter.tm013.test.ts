/**
 * A-12b (@TM-013, @TM-002) – Import: eine Datei mit fehlerhafter Herkunft in der Finalrunde wird abgelehnt und nennt
 * Spiel und Seite. Echter Weg: JSON-Datei → `validateAndParseTournamentImport`. Die Fehlerfälle stehen in der gemeinsamen
 * Fixture `src/core/generators/__fixtures__/finals-plan-errors.json`.
 */
import { describe, it, expect } from 'vitest';
import { validateAndParseTournamentImport } from '../tournamentImporter';
import {
  INVALID_CASES, VALID_CASES, FIXTURE_CASES, importFileOf, planOf,
  type FixtureCase,
} from '../../core/generators/__tests__/finalsPlanFixture';

const pairs = (cases: readonly FixtureCase[]): Array<readonly [string, FixtureCase]> =>
  cases.map((c) => [c.beschreibung, c] as const);

const REASON_FRAGMENT: Record<string, string> = {
  DUPLICATE_IN_PHASE: 'schon vor',
  UNKNOWN_GROUP: 'gibt es im Turnier nicht',
  CYCLE: 'im Kreis',
  MORE_PLACES_THAN_TEAMS: 'Plätze',
  RANK_EXCEEDS_GROUP: 'hat nur',
};

describe('@TM-013 Import: eine fehlerhafte Herkunft wird nicht übernommen', () => {
  it('@TM-013 Pflichttest: „Erster Gruppe C“ als Gastseite von Halbfinale 1 → Import abgelehnt, Meldung nennt „Halbfinale 1, Gastseite“', () => {
    const fixtureCase = FIXTURE_CASES.find((c) => c.id === 'tm013-gruppe-c-fehlt');
    if (fixtureCase === undefined) { throw new Error('Fixture tm013-gruppe-c-fehlt fehlt'); }

    const result = validateAndParseTournamentImport(importFileOf(fixtureCase), 'json');

    expect(result.isValid).toBe(false);
    expect(result.tournament).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('UNKNOWN_GROUP');
    expect(result.errors[0].message).toContain('Halbfinale 1, Gastseite');
    expect(result.errors[0].message).toContain('Gruppe C');
  });

  it.each(pairs(INVALID_CASES.filter((c) => c.szenario === '@TM-013')))(
    '@TM-013 Fehlerfall: %s → Import abgelehnt, Stelle und Grund genannt',
    (_name, fixtureCase) => {
      const result = validateAndParseTournamentImport(importFileOf(fixtureCase), 'json');

      expect(result.isValid).toBe(false);
      expect(result.tournament).toBeUndefined();
      for (const want of fixtureCase.expect.errors ?? []) {
        const error = result.errors.find((e) => e.code === want.code && e.message.includes(want.position));
        expect(error, `${fixtureCase.id}: ${want.code} bei ${want.position}`).toBeDefined();
        expect(error?.message).toContain(REASON_FRAGMENT[want.code]);
      }
      if (fixtureCase.expect.only === true) {
        expect(result.errors).toHaveLength(fixtureCase.expect.errors?.length ?? 0);
      }
    },
  );

  it.each(pairs(VALID_CASES))(
    '@TM-013 Gegenbeispiel: %s → Import gelingt, Herkunft der Plätze bleibt erhalten',
    (_name, fixtureCase) => {
      const plan = planOf(fixtureCase);
      const result = validateAndParseTournamentImport(importFileOf(fixtureCase), 'json');

      expect(result.errors).toEqual([]);
      expect(result.isValid).toBe(true);
      const matches = result.tournament?.matches ?? [];
      expect(matches).toHaveLength(plan.length);
      plan.forEach((fileMatch, index) => {
        const match = matches[index];
        expect(match.isFinal).toBe(true);
        for (const [side, source] of [['A', fileMatch.sourceA], ['B', fileMatch.sourceB]] as const) {
          const slot = side === 'A' ? match.slotA : match.slotB;
          expect(slot.kind).toBe('pending');
          if (slot.kind !== 'pending') { continue; }
          if (source.kind === 'groupRank') {
            expect(slot.source).toEqual(source);
          } else {
            // Verweis auf das Spiel der Datei → neue Spiel-ID des importierten Spiels
            const target = matches[plan.findIndex((m) => m.id === source.match)];
            expect(slot.source).toEqual({ kind: 'matchResult', matchId: target.id, role: source.role });
          }
        }
      });
    },
  );
});

describe('@TM-002 Import: keine Herkunft auf eine Gruppe, die es im Turnier nicht gibt', () => {
  it.each(pairs(INVALID_CASES.filter((c) => c.szenario === '@TM-002')))(
    '@TM-002 Fehlerfall: %s → Import abgelehnt',
    (_name, fixtureCase) => {
      const result = validateAndParseTournamentImport(importFileOf(fixtureCase), 'json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'UNKNOWN_GROUP', message: expect.stringContaining('Halbfinale 2, Gastseite') as string }),
      ]);
    },
  );

  it.each(pairs(VALID_CASES.filter((c) => c.szenario === '@TM-002')))(
    '@TM-002 Gegenbeispiel: %s',
    (_name, fixtureCase) => {
      expect(validateAndParseTournamentImport(importFileOf(fixtureCase), 'json').isValid).toBe(true);
    },
  );
});

describe('@TM-013 Import: Fehler im Dateiformat der Herkunft', () => {
  const base = FIXTURE_CASES.find((c) => c.id === 'gueltig-top4-2gruppen');
  if (base === undefined) { throw new Error('Fixture gueltig-top4-2gruppen fehlt'); }

  const fileWith = (mutate: (plan: ReturnType<typeof planOf>) => unknown[]): string => {
    const data = JSON.parse(importFileOf(base)) as { matches: unknown[] };
    data.matches = mutate(planOf(base)).map((m, i) => ({ ...(m as object), round: i + 1, field: 1, isFinal: true }));
    return JSON.stringify(data);
  };

  it('@TM-013 ein Verweis auf ein Spiel, das in der Datei nicht steht, wird abgelehnt und nennt die Stelle', () => {
    const file = fileWith((plan) =>
      plan.map((m) => (m.id === 'finale' ? { ...m, sourceA: { kind: 'matchResult', match: 'hf9', role: 'winner' } } : m)),
    );

    const result = validateAndParseTournamentImport(file, 'json');

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_MATCH', field: 'matches[3].sourceA', message: expect.stringContaining('hf9') as string }),
    ]);
  });

  it('@TM-013 eine Herkunft mit unbekannter Art oder Rang 0 wird abgelehnt (INVALID_SOURCE)', () => {
    const file = fileWith((plan) =>
      plan.map((m) =>
        m.id === 'hf1'
          ? { ...m, sourceA: { kind: 'zufall' }, sourceB: { kind: 'groupRank', group: 'A', rank: 0 } }
          : m,
      ),
    );

    const result = validateAndParseTournamentImport(file, 'json');

    expect(result.isValid).toBe(false);
    expect(result.errors.map((e) => [e.code, e.field])).toEqual([
      ['INVALID_SOURCE', 'matches[0].sourceA'],
      ['INVALID_SOURCE', 'matches[0].sourceB'],
    ]);
  });

  it('@TM-013 eine Seite mit Team UND Herkunft ist mehrdeutig und wird abgelehnt', () => {
    const file = fileWith((plan) => plan.map((m) => (m.id === 'hf1' ? { ...m, teamA: 'A1' } : m)));

    const result = validateAndParseTournamentImport(file, 'json');

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'AMBIGUOUS_SIDE', field: 'matches[0].sourceA' }),
    ]);
  });

  it('@TM-013 Gegenbeispiel: Gruppenspiele ohne Herkunft bleiben unberührt, die Prüfung betrifft nur die Finalrunde', () => {
    const data = JSON.parse(importFileOf(base)) as { matches: unknown[] };
    data.matches = [{ round: 1, field: 1, teamA: 'A1', teamB: 'A2', group: 'A' }, ...data.matches];

    const result = validateAndParseTournamentImport(JSON.stringify(data), 'json');

    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.tournament?.matches).toHaveLength(5);
  });
});
