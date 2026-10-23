/**
 * Weiche der Schnelleingabe und Uhr der Rückfrage „Spiel beenden“ (20261110_009): @FU-112 (Restzeit), @FU-114 (Spielzeit
 * abgelaufen), @FU-118 (Strafstoßschießen), Gegenbeispiele geplant/beendet/abgesetzt.
 */
import { describe, it, expect } from 'vitest';
import { applyBatch, initialState, type EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { endPromptRestSeconds, routeForStatus } from '../scoreChangeHelpers';

const ctx = { matchId: 'spiel-9', teamAId: 'a', teamBId: 'b' };
const ev = (type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent =>
  ({ id: `${type}-${at}`, type, actor: 'helper', at, section: 1, clockMs: null, teamId: null, payload: {}, ...extra });
const start = ev('MATCH_START', 0, { payload: { rules: RULES } });
const zustand = (events: EngineEvent[]) => applyBatch(initialState(ctx), events, ctx).state;

describe('routeForStatus', () => {
  it.each([
    ['scheduled', 'enter'], ['finished', 'correct'], ['skipped', 'unskip'], ['shootout', 'shootout'],
    ['running', 'end'], ['paused', 'end'], ['section_break', 'end'], ['decision_pending', 'end'],
  ] as const)('%s → %s', (status, route) => {
    expect(routeForStatus(status)).toBe(route);
  });
});

describe('endPromptRestSeconds (2 × 10 Minuten)', () => {
  it('@FU-112 nach 8:00 in der ersten Halbzeit: 120 Sekunden Rest', () => {
    expect(endPromptRestSeconds(zustand([start]), 480_000)).toBe(120);
  });
  it('pausiert nach 5:00: 300 Sekunden Rest', () => {
    expect(endPromptRestSeconds(zustand([start, ev('PAUSE', 300_000)]), 900_000)).toBe(300);
  });
  it('Halbzeitpause: die zweite Halbzeit folgt ganz (600 Sekunden)', () => {
    expect(endPromptRestSeconds(zustand([start, ev('SECTION_END', 600_000, { clockMs: 600_000 })]), 620_000)).toBe(600);
  });
  it('@FU-114 zweite Halbzeit abgelaufen, ohne Abpfiff → null (Spielzeit abgelaufen)', () => {
    const events = [start, ev('SECTION_END', 600_000, { clockMs: 600_000 }), ev('SECTION_START', 660_000, { clockMs: 600_000 })];
    expect(endPromptRestSeconds(zustand(events), 1_400_000)).toBeNull();
  });
  it('Gegenbeispiel: erste Halbzeit über die Zeit (Uhr noch nicht angehalten) → 0, nicht „abgelaufen“', () => {
    expect(endPromptRestSeconds(zustand([start]), 700_000)).toBe(0);
  });
  it('Entscheidung offen (K.-o. nach Ablauf) → null', () => {
    const ko = { ...RULES, knockout: true, tiebreak: null };
    const events = [ev('MATCH_START', 0, { payload: { rules: ko } }), ev('MATCH_END', 1_200_000, { clockMs: 1_200_000 })];
    const state = zustand(events);
    expect(state.status).toBe('decision_pending');
    expect(endPromptRestSeconds(state, 1_210_000)).toBeNull();
  });
});
