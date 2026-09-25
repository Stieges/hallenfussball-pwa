/**
 * Zusätzliche Unit-Tests von applyEvent (Brief Abschnitt 6, letzter Absatz):
 * Immutabilität des Eingangszustands und Abwesenheit von `Date.now()` im Modul.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEvent, initialState } from '../applyEvent';
import type { EngineEvent, MatchContext } from '../types';
import { deepFreeze } from './deepFreeze';

const ctx: MatchContext = { matchId: 'match-immutable', teamAId: 'teamA', teamBId: 'teamB' };

describe('applyEvent Immutabilität', () => {
  it('mutiert den (tiefgefrorenen) Eingangszustand nicht', () => {
    const frozenState = deepFreeze(initialState(ctx));
    const event: EngineEvent = {
      id: 'evt-1',
      type: 'MATCH_START',
      actor: 'helper',
      at: 1000,
      section: 1,
      clockMs: null,
      payload: {
        rules: {
          sections: 2,
          sectionSeconds: 600,
          breakSeconds: 60,
          knockout: false,
          tiebreak: null,
          overtimeSeconds: 0,
          shootersPerTeam: 5,
          suddenDeathAfter: 5,
          penaltySeconds: 120,
        },
      },
    };

    expect(() => applyEvent(frozenState, event, ctx)).not.toThrow();
    const result = applyEvent(frozenState, event, ctx);
    expect(result.status).toBe('accepted');
    // Eingangszustand bleibt exakt der Ausgangswert.
    expect(frozenState.status).toBe('scheduled');
    expect(Object.keys(frozenState.accepted)).toHaveLength(0);
  });

  it('lehnt ab, ohne den Eingangszustand zu ändern', () => {
    const frozenState = deepFreeze(initialState(ctx));
    const invalidEvent: EngineEvent = {
      id: 'evt-2',
      type: 'GOAL',
      actor: 'helper',
      at: 1000,
      section: null,
      clockMs: null,
      teamId: 'teamA',
      payload: {},
    };

    expect(() => applyEvent(frozenState, invalidEvent, ctx)).not.toThrow();
    expect(frozenState.status).toBe('scheduled');
  });
});

describe('initialState() Ctx-Validierung (M10, Fixrunde 1)', () => {
  it('wirft, wenn teamAId === teamBId', () => {
    expect(() => initialState({ matchId: 'm', teamAId: 'team-x', teamBId: 'team-x' })).toThrow();
  });

  it('akzeptiert unterschiedliche Team-IDs', () => {
    expect(() => initialState({ matchId: 'm', teamAId: 'team-a', teamBId: 'team-b' })).not.toThrow();
  });
});

describe('Kein Date.now() im Match-Engine-Modul', () => {
  const moduleFiles = [
    'types.ts',
    'payloadValidation.ts',
    'transitions.ts',
    'applyEvent.ts',
    'reduceMatch.ts',
    'serverState.ts',
    'index.ts',
    'handlers/clock.ts',
    'handlers/records.ts',
    'handlers/correction.ts',
    'handlers/retract.ts',
    'handlers/endcheck.ts',
  ];

  it.each(moduleFiles)('%s enthält kein Date.now()', (fileName) => {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf-8');
    expect(source).not.toMatch(/Date\.now\s*\(/);
  });
});
