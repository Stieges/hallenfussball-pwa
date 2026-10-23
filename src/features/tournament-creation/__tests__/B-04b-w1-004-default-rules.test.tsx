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
 * Der Server darf die Regeln nicht stillschweigend ändern: Die Zeile wird auf
 * alle von `server_rules` gelesenen Eingaben projiziert — aus `config`:
 * `gamePeriods`, `halftimeBreak`, `matchCockpitSettings.penaltyShootersPerTeam`,
 * `matchCockpitSettings.penaltySuddenDeathAfter`; aus `finals_config`:
 * `tiebreaker`, `tiebreakerDuration` — und per `toEqual` gegen dieselbe
 * Projektion des Fixture-`input` verglichen (fehlende Werte als `null` im
 * Fixture). Zusätzlich folgt `expected` den Schnellstart-Vorgaben:
 * expected.sections === draft.gamePeriods, expected.breakSeconds ===
 * draft.halftimeBreak * 60, expected.tiebreak === draft.finalsConfig.tiebreaker.
 *
 * Gegenbeispiel: Ein Entwurf mit `gamePeriods: 5` bzw.
 * `matchCockpitSettings.penaltyShootersPerTeam: 3` erzeugt eine Zeile, die vom
 * Schnellstart-`input` abweicht (≠) — der Vergleich wirkt also.
 * Mutation: (a) Ein von `server_rules` gelesenes Feld im Mapper unter anderem
 * Schlüssel schreiben (supabaseMappers.ts, z. B. `gamePeriods`) → rot.
 * (b) `periods: 1` → `2` in src/config/sports/football.ts → rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';
import { mapTournamentToSupabase } from '../../../core/repositories/supabaseMappers';
import { isPayloadValid } from '../../../core/match/payloadValidation';
import { continueLog } from '../../../core/match/reduceMatch';
import { initialState } from '../../../core/match/applyEvent';
import type { EngineEvent, MatchContext, MatchRules } from '../../../core/match/types';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';
import type { Tournament } from '../../../types/tournament';
import serverRulesSchnellstart from '../../../core/match/__contracts__/server-rules-schnellstart.json';

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
  config: Record<string, unknown>;
  finals: Record<string, unknown> | null;
};

type ServerRulesCase = {
  name: string;
  input: RegelInput;
  expected: MatchRules;
};

const cases = (serverRulesSchnellstart as { cases: ServerRulesCase[] }).cases;

const ctx: MatchContext = { matchId: 'm1', teamAId: 'teamA', teamBId: 'teamB' };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** Alle von `server_rules` aus `config` gelesenen Felder (fehlend = null). */
const configProjektion = (config: unknown) => {
  const c = asRecord(config);
  const settings = asRecord(c.matchCockpitSettings);
  return {
    gamePeriods: c.gamePeriods ?? null,
    halftimeBreak: c.halftimeBreak ?? null,
    matchCockpitSettings: {
      penaltyShootersPerTeam: settings.penaltyShootersPerTeam ?? null,
      penaltySuddenDeathAfter: settings.penaltySuddenDeathAfter ?? null,
    },
  };
};

/** Alle von `server_rules` aus `finals_config` gelesenen Felder (fehlend = null). */
const finalsProjektion = (finals: unknown) => {
  const f = asRecord(finals);
  return {
    tiebreaker: f.tiebreaker ?? null,
    tiebreakerDuration: f.tiebreakerDuration ?? null,
  };
};

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
  it('Schnellstart-Zeile trägt die volle Projektion des Fixture-input (config, finals_config, Dauern) je Fall', () => {
    const { draft } = setupWizard();
    const tournament = draft();
    const { tournamentRow } = mapTournamentToSupabase(tournament, 'owner-1');

    expect(cases.length).toBeGreaterThanOrEqual(2);
    for (const testCase of cases) {
      expect(testCase.input.durationMinutes, `Fall ${testCase.name}`).toBeNull();
      expect(configProjektion(tournamentRow.config), `Fall ${testCase.name} config`).toEqual(
        configProjektion(testCase.input.config)
      );
      expect(finalsProjektion(tournamentRow.finals_config), `Fall ${testCase.name} finals`).toEqual(
        finalsProjektion(testCase.input.finals)
      );
      expect(tournamentRow.group_phase_duration, `Fall ${testCase.name} Dauer`).toBe(
        testCase.input.groupDuration
      );
      expect(tournamentRow.final_round_duration, `Fall ${testCase.name} Dauer`).toBe(
        testCase.input.finalDuration
      );
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
      expect(configProjektion(tournamentRow.config), `Fall ${testCase.name}`).not.toEqual(
        configProjektion(testCase.input.config)
      );
    }
  });

  it('Gegenbeispiel: Entwurf mit penaltyShootersPerTeam 3 weicht vom Schnellstart-input ab (≠)', () => {
    const { setField, draft } = setupWizard();
    setField('matchCockpitSettings', { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyShootersPerTeam: 3 });
    const tournament = draft();
    const { tournamentRow } = mapTournamentToSupabase(tournament, 'owner-1');

    for (const testCase of cases) {
      expect(configProjektion(tournamentRow.config), `Fall ${testCase.name}`).not.toEqual(
        configProjektion(testCase.input.config)
      );
    }
  });
});
