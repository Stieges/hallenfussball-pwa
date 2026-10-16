/**
 * C0a: Unit-Tests zu den neuen Zustandsfeldern (`details`, Abschnittsuhr), zum AMEND-Payload und
 * zum Duplikat-Vergleich ohne `payload.rules` (V3). Die fachlichen Abläufe stehen in den Fixtures
 * 46-57; hier nur, was sich dort schlecht ausdrücken lässt.
 */
import { describe, expect, it } from 'vitest';
import { applyEvent, initialState } from '../applyEvent';
import { isPayloadValid } from '../payloadValidation';
import { isSameEventContent } from '../reduceMatch';
import { toServerState } from '../serverState';
import type { EngineEvent, MatchContext, MatchRules } from '../types';
import { deepFreeze } from './deepFreeze';

const ctx: MatchContext = { matchId: 'match-amend', teamAId: 'teamA', teamBId: 'teamB' };
const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

describe('initialState (C0a)', () => {
  it('startet mit leeren Angaben und Abschnittsuhr 0 / keine Pause', () => {
    const state = initialState(ctx);
    expect(state.details).toEqual({});
    expect(state.sectionStartMs).toBe(0);
    expect(state.breakStartedAt).toBeNull();
  });

  it('details, sectionStartMs und breakStartedAt stehen NICHT im serverState', () => {
    const server = toServerState(initialState(ctx)) as unknown as Record<string, unknown>;
    expect(server).not.toHaveProperty('details');
    expect(server).not.toHaveProperty('sectionStartMs');
    expect(server).not.toHaveProperty('breakStartedAt');
  });
});

describe('AMEND', () => {
  it('mutiert den tiefgefrorenen Eingangszustand nicht', () => {
    let state = initialState(ctx);
    for (const event of [
      ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } }),
      ev({ id: 'g', type: 'GOAL', at: 2000, teamId: 'teamA', payload: { playerNumber: 7, assists: [3] } }),
    ]) {
      const outcome = applyEvent(state, event, ctx);
      if (outcome.status !== 'accepted') {
        throw new Error('Vorbereitung gescheitert');
      }
      state = outcome.state;
    }
    const frozen = deepFreeze(structuredClone(state));
    const amend = ev({ id: 'a', type: 'AMEND', at: 3000, targetId: 'g', payload: { playerNumber: 9, clear: ['assists'] } });
    const outcome = applyEvent(frozen, amend, ctx);
    expect(outcome.status).toBe('accepted');
    expect(frozen.details).toEqual({ g: { playerNumber: 7, assists: [3] } });
    if (outcome.status === 'accepted') {
      expect(outcome.state.details).toEqual({ g: { playerNumber: 9 } });
    }
  });

  it('Payload-Prüfung: targetId Pflicht, mindestens ein Feld oder clear', () => {
    const base = { id: 'a', type: 'AMEND' as const, at: 1 };
    expect(isPayloadValid(ev({ ...base, targetId: 't', payload: { playerNumber: 1 } }), ctx)).toBe(true);
    expect(isPayloadValid(ev({ ...base, targetId: 't', payload: { clear: ['playerId'] } }), ctx)).toBe(true);
    expect(isPayloadValid(ev({ ...base, payload: { playerNumber: 1 } }), ctx)).toBe(false);
    expect(isPayloadValid(ev({ ...base, targetId: 't', payload: {} }), ctx)).toBe(false);
    expect(isPayloadValid(ev({ ...base, targetId: 't', payload: { clear: [] } }), ctx)).toBe(false);
    expect(isPayloadValid(ev({ ...base, targetId: 't', payload: { incomplete: false, clear: ['incomplete'] } }), ctx)).toBe(false);
  });
});

describe('Duplikat-Vergleich (V3)', () => {
  it('ignoriert payload.rules nur bei MATCH_START', () => {
    const start = ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } });
    expect(isSameEventContent(start, { ...start, payload: { rules: { ...RULES, sections: 1 } } })).toBe(true);
    expect(isSameEventContent(start, { ...start, payload: {} })).toBe(true);
    expect(isSameEventContent(start, { ...start, payload: { rules: RULES, extra: 1 } })).toBe(false);

    const goal = ev({ id: 'g', type: 'GOAL', at: 1000, teamId: 'teamA', payload: { rules: 1 } });
    expect(isSameEventContent(goal, { ...goal, payload: { rules: 2 } })).toBe(false);
  });
});
