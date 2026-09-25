/**
 * Fixture-Runner für die reine Spiel-Rechenfunktion (B1a).
 *
 * Lädt alle JSON-Dateien unter __fixtures__/*.json. Ein optionales Feld `prior` (Ruling K6,
 * Fixrunde 1) wird zuerst als gespeicherter Log angewendet (Ergebnisse nicht geprüft) und
 * liefert den Vorzustand für `events`, die je nach `mode` über `continueLog` (log) bzw.
 * `applyBatch` (batch) angewendet werden. `results` wird je Eintrag geprüft (`id`/`status`
 * immer, `code`/`detail` nur wenn im Fixture angegeben -- I9, Fixrunde 1), `serverState` exakt
 * (toEqual) und optional `state` per toMatchObject.
 *
 * M6 (Fixrunde 1): zusätzlich wird jeder Schritt (prior + events) einzeln gegen einen
 * tiefgefrorenen Zustand über `applyEvent` wiederholt, um zu beweisen, dass kein Handler den
 * Eingangszustand mutiert -- das deckt praktisch alle Handler ab, nicht nur MATCH_START.
 *
 * Derselbe Fixture-Satz wird in B3a von der SQL-Zwillingsfunktion konsumiert
 * (Ruling P2/P3) -- das Format hier ist deshalb bindend für beide Seiten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyBatch, continueLog } from '../reduceMatch';
import { applyEvent, initialState } from '../applyEvent';
import { toServerState } from '../serverState';
import { activePenalties, elapsedAt, penaltyRemainingMs } from '../penalties';
import type { EngineEvent, MatchContext } from '../types';
import { deepFreeze } from './deepFreeze';

interface ExpectedResult {
  id: string;
  status: 'accepted' | 'noop' | 'duplicate' | 'rejected';
  code?: string;
  detail?: unknown;
}

/**
 * B1b: optionale Strafen-Prüfungen (TS-only, R18 -- B3a ignoriert sie). Spielzeit der Prüfung:
 * `elapsedMs` explizit, sonst `elapsedAt(clock, at)` bei gegebenem `at`, sonst der Uhrstand.
 */
interface PenaltyCheck {
  elapsedMs?: number;
  at?: number;
  remaining: Record<string, number>;
  active: string[];
}

interface Fixture {
  title: string;
  szenario: string | null;
  ctx: MatchContext;
  mode: 'log' | 'batch';
  prior?: EngineEvent[];
  events: EngineEvent[];
  expect: {
    results: ExpectedResult[];
    serverState: unknown;
    state?: Record<string, unknown>;
    penaltyChecks?: PenaltyCheck[];
  };
}

const fixturesDir = path.join(__dirname, '..', '__fixtures__');
const fixtureFileNames = fs
  .readdirSync(fixturesDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

function loadFixture(fileName: string): Fixture {
  const raw = fs.readFileSync(path.join(fixturesDir, fileName), 'utf-8');
  return JSON.parse(raw) as Fixture;
}

/** M6: jeder Schritt wird zusätzlich gegen einen tiefgefrorenen Klon wiederholt (kein Werfen = keine Mutation). */
function assertNoStepMutatesFrozenInput(startState: ReturnType<typeof initialState>, events: readonly EngineEvent[], ctx: MatchContext): void {
  let state = startState;
  for (const event of events) {
    const frozenClone = deepFreeze(structuredClone(state));
    expect(() => applyEvent(frozenClone, event, ctx)).not.toThrow();

    const outcome = applyEvent(state, event, ctx);
    if (outcome.status === 'accepted' || outcome.status === 'noop') {
      state = outcome.state;
    }
  }
}

describe('Match-Engine Fixtures', () => {
  it('findet mindestens die im Brief geforderten 14 Fixture-Themen (mehr Dateien durch 12a/12b/05b/08b etc.)', () => {
    expect(fixtureFileNames.length).toBeGreaterThanOrEqual(14);
  });

  for (const fileName of fixtureFileNames) {
    const fixture = loadFixture(fileName);

    it(`${fileName}: ${fixture.title}`, () => {
      const priorEvents = fixture.prior ?? [];
      const priorResult = continueLog(initialState(fixture.ctx), priorEvents, fixture.ctx);
      const startState = priorResult.state;

      const outcome =
        fixture.mode === 'log'
          ? continueLog(startState, fixture.events, fixture.ctx)
          : applyBatch(startState, fixture.events, fixture.ctx);

      expect(outcome.results.length).toBe(fixture.expect.results.length);
      outcome.results.forEach((actual, index) => {
        const expected = fixture.expect.results[index];
        expect(actual.id).toBe(expected.id);
        expect(actual.status).toBe(expected.status);
        if (expected.code !== undefined) {
          expect(actual.code).toBe(expected.code);
        } else {
          expect(actual.code).toBeUndefined();
        }
        if (expected.detail !== undefined) {
          expect(actual.detail).toEqual(expected.detail);
        }
      });

      expect(toServerState(outcome.state)).toEqual(fixture.expect.serverState);
      if (fixture.expect.state) {
        expect(outcome.state).toMatchObject(fixture.expect.state);
      }

      for (const check of fixture.expect.penaltyChecks ?? []) {
        const clock = outcome.state.clock;
        const elapsedMs = check.elapsedMs ?? (check.at !== undefined ? elapsedAt(clock, check.at) : clock.elapsedMs);
        const remaining: Record<string, number> = {};
        for (const penalty of outcome.state.penalties) {
          remaining[penalty.id] = penaltyRemainingMs(penalty, elapsedMs);
        }
        expect(remaining).toEqual(check.remaining);
        expect(activePenalties(outcome.state, elapsedMs).map((penalty) => penalty.id)).toEqual(check.active);
      }

      assertNoStepMutatesFrozenInput(initialState(fixture.ctx), [...priorEvents, ...fixture.events], fixture.ctx);
    });
  }
});
