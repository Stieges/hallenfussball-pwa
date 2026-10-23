/**
 * useEndstandHalten / gehaltenesSpielOf (@FU-115): ein angepfiffenes Spiel, das die Turnierleitung im Spielplan beendet hat,
 * steht im Cockpit 30 Sekunden mit „Ende – eingetragen im Spielplan (von Olli)“ wie nach einem Abpfiff. Gegenbeispiel: ein
 * nie angepfiffenes, direkt eingetragenes Spiel (@FU-080) wird nicht gehalten (unverändert, S1).
 */
import { describe, expect, it } from 'vitest';
import { applyBatch, initialState, type EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import type { ScheduledMatch } from '../../../../core/generators';
import type { LiveMatch } from '../../../../components/live-cockpit/types';
import { gehaltenesSpielOf } from '../useEndstandHalten';

const ctx = { matchId: 'spiel-9', teamAId: 'a', teamBId: 'b' };
const ev = (id: string, type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent =>
  ({ id, type, actor: 'helper', at, section: 1, clockMs: null, teamId: null, payload: {}, ...extra });
const ende = (at: number): EngineEvent => ev('e9', 'RESULT_ENTRY', at, { actor: 'leitung', section: null, payload: { scores: { a: 3, b: 1 }, basedOn: null } });

function gehalten(events: EngineEvent[], jetzt: number) {
  const state = applyBatch(initialState(ctx), events, ctx).state;
  const engine = { view: () => ({ result: { state, localRejected: [], needsFullReload: false }, log: events, confirmedCount: events.length }), serverNow: () => jetzt };
  const live = new Map([['spiel-9', { status: 'FINISHED' } as LiveMatch]]);
  return gehaltenesSpielOf([{ id: 'spiel-9' } as ScheduledMatch], live, engine, []);
}

describe('gehaltenesSpielOf: im Spielplan beendet', () => {
  it('@FU-115 angepfiffen und im Spielplan beendet → 12 Sekunden danach noch gehalten', () => {
    expect(gehalten([ev('s', 'MATCH_START', 1000, { payload: { rules: RULES } }), ende(100_000)], 112_000).id).toBe('spiel-9');
  });
  it('Gegenbeispiel: nach 30 Sekunden nicht mehr', () => {
    expect(gehalten([ev('s', 'MATCH_START', 1000, { payload: { rules: RULES } }), ende(100_000)], 131_000).id).toBeNull();
  });
  it('Gegenbeispiel @FU-080: nie angepfiffen, direkt eingetragen → nicht gehalten', () => {
    expect(gehalten([{ ...ende(100_000), payload: { scores: { a: 3, b: 1 } } }], 105_000).id).toBeNull();
  });
});
