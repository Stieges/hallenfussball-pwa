/**
 * Gleichlauf-Fixtures für `serverRules` (C0a, RC2/V6): jede Datei unter `__fixtures__/rules/*.json`
 * `{ title, input, expect }` muss exakt das liefern, was `match_engine.server_rules` (003) liefert.
 * C0b vergleicht dieselben Dateien gegen SQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { serverRules, type ServerRulesInput } from '../client/serverRules';
import { MatchRulesSchema } from '../types';

interface RulesFixture {
  title: string;
  input: ServerRulesInput;
  expect: unknown;
}

const rulesDir = path.join(__dirname, '..', '__fixtures__', 'rules');
const fileNames = fs
  .readdirSync(rulesDir)
  .filter((name) => name.endsWith('.json'))
  .sort();

function load(fileName: string): RulesFixture {
  return JSON.parse(fs.readFileSync(path.join(rulesDir, fileName), 'utf-8')) as RulesFixture;
}

describe('serverRules (Gleichlauf mit match_engine.server_rules)', () => {
  it('hat mindestens 12 Regel-Fixtures', () => {
    expect(fileNames.length).toBeGreaterThanOrEqual(12);
  });

  for (const fileName of fileNames) {
    const fixture = load(fileName);
    it(`${fileName}: ${fixture.title}`, () => {
      const rules = serverRules(fixture.input);
      expect(rules).toEqual(fixture.expect);
      // Das Ergebnis muss selbst ein gültiger MATCH_START-Regelsatz sein (Ganzzahlen, Bereiche).
      expect(MatchRulesSchema.safeParse(rules).success).toBe(true);
    });
  }

  it('ist rein: dieselbe Eingabe ergibt dasselbe Ergebnis, die Eingabe bleibt unverändert', () => {
    const input: ServerRulesInput = {
      durationMinutes: null,
      phase: 'final',
      groupPhaseDuration: 10,
      finalRoundDuration: 12,
      config: { gamePeriods: '2', matchCockpitSettings: { penaltyShootersPerTeam: 3 } },
      finalsConfig: { tiebreaker: 'goldenGoal', tiebreakerDuration: 3 },
    };
    const snapshot = structuredClone(input);
    expect(serverRules(input)).toEqual(serverRules(input));
    expect(input).toEqual(snapshot);
  });
});
