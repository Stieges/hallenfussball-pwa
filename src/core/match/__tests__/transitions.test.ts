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

  // M7 (Fixrunde 1): unabhängige Abschrift von Brief §2 (nicht aus matchTransitions.json
  // generiert), damit eine versehentliche Zeilenänderung vor dem B2-Seed aus dieser Datei
  // auffällt statt nur den Ladecheck zu wiederholen.
  it('entspricht Zeile für Zeile der Brief-§2-Liste (unabhängige Abschrift, sortiert)', () => {
    const expectedRows: TransitionRow[] = [
      { from: 'scheduled', type: 'MATCH_START', actor: 'helper', to: 'running' },
      { from: 'scheduled', type: 'SKIP', actor: 'leitung', to: 'skipped' },
      { from: 'scheduled', type: 'RESULT_ENTRY', actor: 'leitung', to: 'finished' },

      { from: 'running', type: 'GOAL', actor: 'helper', to: '=' },
      { from: 'running', type: 'OWN_GOAL', actor: 'helper', to: '=' },
      { from: 'running', type: 'YELLOW_CARD', actor: 'helper', to: '=' },
      { from: 'running', type: 'YELLOW_RED_CARD', actor: 'helper', to: '=' },
      { from: 'running', type: 'RED_CARD', actor: 'helper', to: '=' },
      { from: 'running', type: 'TIME_PENALTY', actor: 'helper', to: '=' },
      { from: 'running', type: 'FOUL', actor: 'helper', to: '=' },
      { from: 'running', type: 'SUBSTITUTION', actor: 'helper', to: '=' },
      { from: 'running', type: 'RETRACT', actor: 'helper', to: '=' },
      { from: 'running', type: 'CLOCK_ADJUST', actor: 'helper', to: '=' },
      { from: 'running', type: 'PAUSE', actor: 'helper', to: 'paused' },
      { from: 'running', type: 'SECTION_END', actor: 'helper', to: 'section_break' },
      { from: 'running', type: 'MATCH_END', actor: 'helper', to: '@endcheck' },

      { from: 'paused', type: 'RESUME', actor: 'helper', to: 'running' },
      { from: 'paused', type: 'YELLOW_CARD', actor: 'helper', to: '=' },
      { from: 'paused', type: 'YELLOW_RED_CARD', actor: 'helper', to: '=' },
      { from: 'paused', type: 'RED_CARD', actor: 'helper', to: '=' },
      { from: 'paused', type: 'TIME_PENALTY', actor: 'helper', to: '=' },
      { from: 'paused', type: 'SUBSTITUTION', actor: 'helper', to: '=' },
      { from: 'paused', type: 'RETRACT', actor: 'helper', to: '=' },
      { from: 'paused', type: 'CLOCK_ADJUST', actor: 'helper', to: '=' },
      { from: 'paused', type: 'MATCH_END', actor: 'helper', to: '@endcheck' },

      { from: 'section_break', type: 'SECTION_START', actor: 'helper', to: 'running' },
      { from: 'section_break', type: 'YELLOW_CARD', actor: 'helper', to: '=' },
      { from: 'section_break', type: 'YELLOW_RED_CARD', actor: 'helper', to: '=' },
      { from: 'section_break', type: 'RED_CARD', actor: 'helper', to: '=' },
      { from: 'section_break', type: 'SUBSTITUTION', actor: 'helper', to: '=' },
      { from: 'section_break', type: 'RETRACT', actor: 'helper', to: '=' },

      { from: 'decision_pending', type: 'TIEBREAK_CHOICE', actor: 'helper', to: '=' },

      { from: 'shootout', type: 'SHOOTOUT_KICK', actor: 'helper', to: '=' },
      { from: 'shootout', type: 'RETRACT', actor: 'helper', to: '=' },
      { from: 'shootout', type: 'SHOOTOUT_END', actor: 'helper', to: 'finished' },

      { from: 'finished', type: 'CORRECTION', actor: 'leitung', to: '=' },
      { from: 'finished', type: 'REOPEN', actor: 'leitung', to: 'running' },
      { from: 'finished', type: 'RETRACT', actor: 'leitung', to: '=' },

      { from: 'skipped', type: 'UNSKIP', actor: 'leitung', to: 'scheduled' },
    ];

    const sortKey = (row: TransitionRow): string => `${row.from}::${row.type}`;
    const sortedExpected = [...expectedRows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const sortedActual = [...transitions].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    expect(sortedActual).toEqual(sortedExpected);
  });
});
