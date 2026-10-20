/**
 * A-12b – Fehlerhafte Herkunft wird abgelehnt (Record Turniermodi).
 *
 * @TM-013: Eine fehlerhafte Einstellung der Finalrunde wird nicht übernommen und nennt Stelle und Grund
 *   (Team doppelt in einer Phase, Gruppe gibt es nicht, Herkunft im Kreis, mehr Plätze als Teams).
 * @TM-002: Keine Herkunft verweist auf eine Gruppe, die es im Turnier nicht gibt.
 * C-TOP4-ZU-WENIG-TEAMS: der Rang einer Herkunft darf die Gruppengröße nicht übersteigen (Code RANK_EXCEEDS_GROUP).
 *
 * Die Fehlerfälle stehen in `__fixtures__/finals-plan-errors.json` (dieselbe Datei prüft ab A-15a `set_slot_source`).
 * Die Erwartungen stammen aus dem Gherkin (Stelle = Spalte „Stelle“ der Beispiele), nicht aus dem Code.
 */
import { describe, it, expect } from 'vitest';
import { validateFinalsPlan, formatFinalsPlanError, type FinalsPlanError } from '../validateFinalsPlan';
import { generateFullSchedule } from '..';
import { pendingSlot } from '../../models/matchSlot';
import type { Match, Team, FinalsConfig } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import {
  INVALID_CASES, VALID_CASES, matchesOf, matchIdOf, planOf,
  type FixtureCase, type FixtureError,
} from './finalsPlanFixture';

const casesOf = (cases: readonly FixtureCase[], szenario: string): FixtureCase[] =>
  cases.filter((c) => c.szenario === szenario);

/** Jeder erwartete Fehler kommt vor (Spiel, Seite, Code, Stelle); bei `only` gibt es keine weiteren. */
function expectErrors(actual: readonly FinalsPlanError[], fixtureCase: FixtureCase): void {
  const expected: FixtureError[] = fixtureCase.expect.errors ?? [];
  const plan = planOf(fixtureCase);
  for (const want of expected) {
    expect(actual, `${fixtureCase.id}: ${want.code} bei ${want.position}`).toContainEqual(
      expect.objectContaining({
        matchId: matchIdOf(plan, want.match), code: want.code, position: want.position,
        ...(want.side === undefined ? {} : { side: want.side }), // Fehler der ganzen Phase haben keine Seite
      }),
    );
  }
  if (fixtureCase.expect.only === true) {
    expect(actual).toHaveLength(expected.length);
  }
}

const REASON_FRAGMENT: Record<string, string> = {
  DUPLICATE_IN_PHASE: 'schon vor',
  UNKNOWN_GROUP: 'gibt es im Turnier nicht',
  CYCLE: 'im Kreis',
  MORE_PLACES_THAN_TEAMS: 'Plätze',
  RANK_EXCEEDS_GROUP: 'hat nur',
};

describe('@TM-013 Eine fehlerhafte Einstellung wird nicht übernommen', () => {
  it.each(casesOf(INVALID_CASES, '@TM-013').map((c) => [c.beschreibung, c] as const))(
    '@TM-013 Fehlerfall: %s → abgelehnt, Stelle genannt',
    (_name, fixtureCase) => {
      const result = validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups);

      expect(result.ok).toBe(false);
      if (!result.ok) { expectErrors(result.errors, fixtureCase); }
    },
  );

  it.each(casesOf(INVALID_CASES, '@TM-013').map((c) => [c.beschreibung, c] as const))(
    '@TM-013 Meldung nennt Stelle und Grund: %s',
    (_name, fixtureCase) => {
      const result = validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups);
      const errors = result.ok ? [] : result.errors;

      expect(errors.length).toBeGreaterThan(0);
      for (const want of fixtureCase.expect.errors ?? []) {
        const error = errors.find((e) => e.code === want.code && e.position === want.position);
        expect(error, `${fixtureCase.id}: ${want.code}`).toBeDefined();
        const message = error === undefined ? '' : formatFinalsPlanError(error);
        expect(message).toContain(want.position);
        expect(message).toContain(REASON_FRAGMENT[want.code]);
      }
    },
  );

  it.each(casesOf(VALID_CASES, '@TM-013').map((c) => [c.beschreibung, c] as const))(
    '@TM-013 Gegenbeispiel: %s → keine Fehlalarme',
    (_name, fixtureCase) => {
      expect(validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups)).toEqual({ ok: true });
    },
  );

  it('@TM-013 Pflichttest: „Erster Gruppe C“ als Gastseite von Halbfinale 1 nennt „Halbfinale 1, Gastseite“', () => {
    const fixtureCase = INVALID_CASES.find((c) => c.id === 'tm013-gruppe-c-fehlt');
    expect(fixtureCase).toBeDefined();
    if (fixtureCase === undefined) { return; }

    const result = validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups);

    expect(result.ok).toBe(false);
    if (result.ok) { return; }
    expect(result.errors.map((e) => formatFinalsPlanError(e))).toEqual([
      expect.stringContaining('Halbfinale 1, Gastseite'),
    ]);
  });

  it('@TM-013 die Stelle richtet sich nach der Bezeichnung des Spiels, nicht nach der Reihenfolge in der Liste', () => {
    const fixtureCase = INVALID_CASES.find((c) => c.id === 'tm013-team-doppelt');
    if (fixtureCase === undefined) { throw new Error('Fixture tm013-team-doppelt fehlt'); }
    const matches = [...matchesOf(fixtureCase)].reverse();

    const result = validateFinalsPlan(matches, fixtureCase.groups);

    expect(result.ok).toBe(false);
    if (result.ok) { return; }
    // gemeldet wird die zweite Nennung in Listen-Reihenfolge: umgedreht steht Halbfinale 2 vorn, Halbfinale 1 (Heimseite) ist die zweite Nennung
    expect(result.errors.map((e) => e.position)).toEqual(['Halbfinale 1, Heimseite']);
  });

  it('@TM-013 ein Verweis auf ein Spiel, das es nicht gibt, wird abgelehnt (nicht still übernommen)', () => {
    const fixtureCase = VALID_CASES.find((c) => c.id === 'gueltig-top4-2gruppen');
    if (fixtureCase === undefined) { throw new Error('Fixture fehlt'); }
    const matches: Match[] = matchesOf(fixtureCase).map((m) =>
      m.label === 'Finale'
        ? { ...m, originA: { kind: 'matchResult', matchId: testUuid(999), role: 'winner' }, slotA: pendingSlot({ kind: 'matchResult', matchId: testUuid(999), role: 'winner' }) }
        : m,
    );

    const result = validateFinalsPlan(matches, fixtureCase.groups);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([expect.objectContaining({ code: 'UNKNOWN_MATCH', side: 'A', position: 'Finale, Heimseite' })]);
    }
  });

  it('@TM-013 Herkunft im Kreis über zwei Halbfinals: beide Heimseiten werden genannt, der gültige Rest nicht', () => {
    const fixtureCase = VALID_CASES.find((c) => c.id === 'gueltig-top4-2gruppen');
    if (fixtureCase === undefined) { throw new Error('Fixture fehlt'); }
    const plan = planOf(fixtureCase).map((m) => {
      if (m.id === 'hf1') { return { ...m, sourceA: { kind: 'matchResult', match: 'hf2', role: 'winner' } as const }; }
      if (m.id === 'hf2') { return { ...m, sourceA: { kind: 'matchResult', match: 'hf1', role: 'winner' } as const }; }
      return m;
    });

    const result = validateFinalsPlan(matchesOf(fixtureCase, plan), fixtureCase.groups);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => [e.code, e.position])).toEqual([
        ['CYCLE', 'Halbfinale 1, Heimseite'],
        ['CYCLE', 'Halbfinale 2, Heimseite'],
      ]);
    }
  });

  it('@TM-013 ohne Bezeichnung entscheidet die Phase der Datei; ohne beides gilt „Finale“ als Phase', () => {
    const fixtureCase = VALID_CASES.find((c) => c.id === 'gueltig-top4-2gruppen');
    if (fixtureCase === undefined) { throw new Error('Fixture fehlt'); }
    const withoutLabels = matchesOf(fixtureCase).map((m) => ({ ...m, label: undefined }));

    expect(validateFinalsPlan(withoutLabels, fixtureCase.groups)).toEqual({ ok: true });

    const duplicate = withoutLabels.map((m, i) => (i === 1 ? { ...m, slotB: m.slotA, originB: m.originA } : m));
    const result = validateFinalsPlan(duplicate, fixtureCase.groups);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([expect.objectContaining({ code: 'DUPLICATE_IN_PHASE', side: 'B', position: 'Halbfinale 2, Gastseite' })]);
    }
  });
});

describe('@TM-002 Keine Herkunft verweist auf eine Gruppe, die es im Turnier nicht gibt', () => {
  it.each(casesOf(INVALID_CASES, '@TM-002').map((c) => [c.beschreibung, c] as const))(
    '@TM-002 Fehlerfall: %s → abgelehnt',
    (_name, fixtureCase) => {
      const result = validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups);

      expect(result.ok).toBe(false);
      if (!result.ok) { expectErrors(result.errors, fixtureCase); }
    },
  );

  it.each(casesOf(VALID_CASES, '@TM-002').map((c) => [c.beschreibung, c] as const))(
    '@TM-002 Gegenbeispiel: %s',
    (_name, fixtureCase) => {
      expect(validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups)).toEqual({ ok: true });
    },
  );
});

describe('Rang größer als die Gruppe (Befund siehe Dateikopf)', () => {
  it.each(INVALID_CASES.filter((c) => c.befund === 'C-TOP4-ZU-WENIG-TEAMS').map((c) => [c.beschreibung, c] as const))(
    '@TM-013 RANK_EXCEEDS_GROUP: %s',
    (_name, fixtureCase) => {
      const result = validateFinalsPlan(matchesOf(fixtureCase), fixtureCase.groups);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'RANK_EXCEEDS_GROUP')).toBe(true);
        expectErrors(result.errors, fixtureCase);
      }
    },
  );
});

describe('@TM-013 Gegenbeispiel über den echten Weg: Pläne des Generators für 1 und 2 Gruppen', () => {
  const teamsOf = (groups: string[], perGroup: number): Team[] =>
    groups.flatMap((group, g) =>
      Array.from({ length: perGroup }, (_, n) => ({ id: testUuid(g * 10 + n + 1), name: `Team ${group}${n + 1}`, group })),
    );

  const cases: ReadonlyArray<readonly [string, FinalsConfig, string[]]> = [
    ['Top 4, 2 Gruppen', { preset: 'top-4' }, ['A', 'B']],
    ['Alle Plätze, 2 Gruppen', { preset: 'all-places' }, ['A', 'B']],
    ['Top 4, 1 Gruppe', { preset: 'top-4' }, ['A']],
    ['nur Finale, 2 Gruppen', { preset: 'final-only' }, ['A', 'B']],
  ];

  it.each(cases)('@TM-013 Generator-Plan „%s“ mit 4 Teams je Gruppe → ok', (_name, finalsConfig, groups) => {
    const teams = teamsOf(groups, 4);
    const tournament = createMockTournament({
      teams, numberOfTeams: teams.length, numberOfGroups: groups.length, numberOfFields: 2,
      groupSystem: 'groupsAndFinals', finalsConfig,
    });

    const schedule = generateFullSchedule(tournament);
    const finals = schedule.allMatches.filter((m) => m.phase !== 'groupStage');

    expect(finals.length).toBeGreaterThan(0);
    expect(validateFinalsPlan(finals, groups.map((id) => ({ id, teamCount: 4 })))).toEqual({ ok: true });
  });
});
