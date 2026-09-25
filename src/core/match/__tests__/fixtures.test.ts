/**
 * Fixture-Runner für die reine Spiel-Rechenfunktion (B1a).
 *
 * Lädt alle JSON-Dateien unter __fixtures__/*.json, wendet sie je nach `mode`
 * über reduceMatch (log) bzw. applyBatch (batch, ab initialState) an und
 * vergleicht `results` exakt (nur id/status/code, siehe Brief Abschnitt 6),
 * `serverState` exakt (toEqual) und optional `state` per toMatchObject.
 *
 * Derselbe Fixture-Satz wird in B3a von der SQL-Zwillingsfunktion konsumiert
 * (Ruling P2/P3) -- das Format hier ist deshalb bindend für beide Seiten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyBatch, reduceMatch } from '../reduceMatch';
import { initialState } from '../applyEvent';
import { toServerState } from '../serverState';
import type { EngineEvent, MatchContext } from '../types';

interface ExpectedResult {
  id: string;
  status: 'accepted' | 'noop' | 'duplicate' | 'rejected';
  code?: string;
}

interface Fixture {
  title: string;
  szenario: string | null;
  ctx: MatchContext;
  mode: 'log' | 'batch';
  events: EngineEvent[];
  expect: {
    results: ExpectedResult[];
    serverState: unknown;
    state?: Record<string, unknown>;
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

describe('Match-Engine Fixtures', () => {
  it('findet mindestens die im Brief geforderten 14 Fixture-Themen (15 Dateien wegen 12a/12b)', () => {
    expect(fixtureFileNames.length).toBeGreaterThanOrEqual(14);
  });

  for (const fileName of fixtureFileNames) {
    const fixture = loadFixture(fileName);

    it(`${fileName}: ${fixture.title}`, () => {
      const outcome =
        fixture.mode === 'log'
          ? reduceMatch(fixture.events, fixture.ctx)
          : applyBatch(initialState(fixture.ctx), fixture.events, fixture.ctx);

      const actualResults = outcome.results.map((result) =>
        result.code === undefined
          ? { id: result.id, status: result.status }
          : { id: result.id, status: result.status, code: result.code }
      );

      expect(actualResults).toEqual(fixture.expect.results);
      expect(toServerState(outcome.state)).toEqual(fixture.expect.serverState);
      if (fixture.expect.state) {
        expect(outcome.state).toMatchObject(fixture.expect.state);
      }
    });
  }
});
