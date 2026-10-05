/**
 * B-04b Fixrunde 1 — @W1-004: Vertrag Schnellstart → Server-Regeln über ein gemeinsames Fixture.
 *
 * Gegeben ein Turnier wurde im Schnellstart ohne Änderung der Regeln angelegt
 * Wenn am Turniertag ein Spiel gestartet wird
 * Dann nimmt der Server die Regeln (Dauer, Abschnitte, Halbzeitpause,
 * Entscheidung im Finale) ohne Fehler an
 *
 * Echter Bedienweg: useTournamentWizard (Schnellstart-Entwurf) → echter
 * mapTournamentToSupabase (supabaseMappers.ts) → die Zeilenfelder `config`,
 * `finals_config`, `group_phase_duration`, `final_round_duration` enthalten den
 * `input` des gemeinsamen Fixtures `server-rules-schnellstart.json`. Dessen
 * `expected` besteht isPayloadValid und die TS-Engine nimmt MATCH_START damit an.
 * Die SQL-Seite (match_engine.server_rules) prüft dasselbe Fixture in
 * `scripts/append-match-events-check.sh` (Kategorie Sonstiges, @W1-004).
 *
 * Der Server darf die Regeln nicht stillschweigend ändern: expected.sections ===
 * draft.gamePeriods, expected.breakSeconds === draft.halftimeBreak * 60,
 * expected.tiebreak === draft.finalsConfig.tiebreaker.
 *
 * Gegenbeispiel: Ein Entwurf mit `gamePeriods: 5` erzeugt eine Zeile, die vom
 * Schnellstart-`input` abweicht (≠) — der Vergleich wirkt also.
 * Mutation: (a) Im Mapper `gamePeriods` unter anderem Schlüssel schreiben
 * (supabaseMappers.ts) → rot. (b) `periods: 1` → `2` in
 * src/config/sports/football.ts → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { mapTournamentToSupabase } from '../../../core/repositories/supabaseMappers';
import { isPayloadValid } from '../../../core/match/payloadValidation';
import { continueLog } from '../../../core/match/reduceMatch';
import { initialState } from '../../../core/match/applyEvent';
import type { EngineEvent, MatchContext, MatchRules } from '../../../core/match/types';
import type { Tournament } from '../../../types/tournament';
import serverRulesSchnellstart from '../../../core/match/__fixtures__/server-rules-schnellstart.json';

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }),
}));

type RegelInput = {
  durationMinutes: number | null;
  phase: string;
  groupDuration: number;
  finalDuration: number;
  config: Record<string, number | string | boolean | null>;
  finals: Record<string, number | string | boolean | null> | null;
};

type ServerRulesCase = {
  name: string;
  input: RegelInput;
  expected: MatchRules;
};

const cases = (serverRulesSchnellstart as { cases: ServerRulesCase[] }).cases;

const ctx: MatchContext = { matchId: 'm1', teamAId: 'teamA', teamBId: 'teamB' };

type MappedRow = ReturnType<typeof mapTournamentToSupabase>['tournamentRow'];

/** Zeilenfeld enthält jeden Blattwert des Fixture-Ausschnitts (Schlüssel + Wert). */
const containsLeaves = (haystack: unknown, needle: Record<string, unknown> | null): boolean => {
  const record = (haystack ?? {}) as Record<string, unknown>;
  return Object.entries(needle ?? {}).every(([key, value]) => record[key] === value);
};

/** `input` des Fixtures steckt in den Zeilenfeldern, die der Mapper schreibt. */
const rowCarriesInput = (row: MappedRow, input: RegelInput): boolean =>
  containsLeaves(row.config, input.config) &&
  containsLeaves(row.finals_config, input.finals) &&
  row.group_phase_duration === input.groupDuration &&
  row.final_round_duration === input.finalDuration;

function setupWizard() {
  const wizard = renderHook(() => useTournamentWizard());
  const setField = <K extends keyof Tournament>(field: K, value: Tournament[K]) => {
    act(() => {
      wizard.result.current.updateForm(field, value);
    });
  };
  const draft = () => wizard.result.current.createDraftTournament();
  return { setField, draft };
}

describe('B-04b @W1-004 – Vertrag Schnellstart → Server-Regeln (gemeinsames Fixture)', () => {
  it('Schnellstart-Zeile enthält den Fixture-input (config, finals_config, Dauern) je Fall', () => {
    const { draft } = setupWizard();
    const tournament = draft();
    const { tournamentRow } = mapTournamentToSupabase(tournament, 'owner-1');

    expect(cases.length).toBeGreaterThanOrEqual(2);
    for (const testCase of cases) {
      expect(testCase.input.durationMinutes, `Fall ${testCase.name}`).toBeNull();
      expect(rowCarriesInput(tournamentRow, testCase.input), `Fall ${testCase.name}`).toBe(true);
    }
  });

  it('Server ändert die Regeln nicht stillschweigend: expected folgt den Schnellstart-Vorgaben', () => {
    const { draft } = setupWizard();
    const tournament = draft();

    for (const testCase of cases) {
      expect(testCase.expected.sections, `Fall ${testCase.name}`).toBe(tournament.gamePeriods);
      expect(testCase.expected.breakSeconds, `Fall ${testCase.name}`).toBe(
        (tournament.halftimeBreak ?? 0) * 60
      );
      expect(testCase.expected.tiebreak, `Fall ${testCase.name}`).toBe(
        tournament.finalsConfig?.tiebreaker
      );
    }
  });

  it('expected besteht die Regel-Prüfung beim Anpfiff und die TS-Engine nimmt MATCH_START an', () => {
    for (const testCase of cases) {
      const startEvent: EngineEvent = {
        id: `evt-${testCase.name}`,
        type: 'MATCH_START',
        actor: 'helper',
        at: 1000,
        section: 1,
        clockMs: null,
        payload: { rules: testCase.expected },
        actorUser: 'helper',
      };
      expect(isPayloadValid(startEvent, ctx), `Fall ${testCase.name}`).toBe(true);
      const outcome = continueLog(initialState(ctx), [startEvent], ctx);
      expect(outcome.results[0].status, `Fall ${testCase.name}`).toBe('accepted');
    }
  });

  it('Gegenbeispiel: Entwurf mit gamePeriods 5 weicht vom Schnellstart-input ab (≠)', () => {
    const { setField, draft } = setupWizard();
    setField('gamePeriods', 5);
    const tournament = draft();
    const { tournamentRow } = mapTournamentToSupabase(tournament, 'owner-1');

    for (const testCase of cases) {
      expect(rowCarriesInput(tournamentRow, testCase.input), `Fall ${testCase.name}`).toBe(false);
    }
  });
});
