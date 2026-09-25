/**
 * Zusätzliche Unit-Tests der Übergangstabelle (Brief Abschnitt 6, letzter Absatz).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertUniqueTransitionRows, transitions, TransitionsFileSchema, type TransitionRow } from '../transitions';
import { MatchStatusSchema } from '../types';

describe('matchTransitions.json', () => {
  it('hat genau eine Zeile je (from, type)', () => {
    const seen = new Set<string>();
    for (const row of transitions) {
      const key = `${row.from}::${row.type}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(transitions.length).toBe(seen.size);
  });

  it('jede `to` ist ein gültiger MatchStatus, "=" oder "@endcheck"', () => {
    for (const row of transitions) {
      const isSelf = row.to === '=';
      const isEndcheck = row.to === '@endcheck';
      const isValidStatus = MatchStatusSchema.safeParse(row.to).success;
      expect(isSelf || isEndcheck || isValidStatus).toBe(true);
    }
  });

  it('deckt alle 8 Zustände als `from` ab (Ruling P1: vollständige Tabelle)', () => {
    const froms = new Set(transitions.map((row) => row.from));
    for (const status of MatchStatusSchema.options) {
      expect(froms.has(status)).toBe(true);
    }
  });

  it('assertUniqueTransitionRows wirft bei doppelter (from, type)-Zeile', () => {
    const duplicated: TransitionRow[] = [
      { from: 'scheduled', type: 'MATCH_START', actor: 'helper', to: 'running' },
      { from: 'scheduled', type: 'MATCH_START', actor: 'leitung', to: 'running' },
    ];
    expect(() => assertUniqueTransitionRows(duplicated)).toThrow();
  });

  it('Zod-Laden schlägt bei kaputter JSON laut fehl', () => {
    expect(() => TransitionsFileSchema.parse({ transitions: [{ from: 'kaputt', type: 'GOAL', actor: 'helper', to: 'running' }] })).toThrow();
    expect(() => TransitionsFileSchema.parse({ transitions: [{ from: 'scheduled', type: 'GOAL', actor: 'referee', to: 'running' }] })).toThrow();
    expect(() => TransitionsFileSchema.parse({ transitions: 'nicht-mal-ein-array' })).toThrow();
  });

  it('matchTransitions.json selbst validiert gegen das Schema (Regressionsschutz)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'matchTransitions.json'), 'utf-8');
    expect(() => TransitionsFileSchema.parse(JSON.parse(raw))).not.toThrow();
  });
});
