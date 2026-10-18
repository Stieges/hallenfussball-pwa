/**
 * A-08f3e4 Punkt 3 – Regel S Stufe 2 (Plan `task-A-08f3-plan.md` v4 § 2.2): Jedes Spiel mit Cloud-Revision ≥ der zuletzt
 * übernommenen wird übernommen, auch Revision 1. Monotonie bleibt: ein älterer Stand wird verworfen.
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import { describe, it, expect } from 'vitest';
import { isServerLed, mergeServerLedFields } from '../serverLedMatchFields';
import { createMockMatch, createMockTournament } from '../../../test/factories';

describe('A-08f3e4 Regel S Stufe 2', () => {
  it('@FU-023 Revision 1 (Seed/Altbestand ohne Einträge) wird übernommen', () => {
    expect(isServerLed(1, undefined, 'stufe2')).toBe(true);
    expect(isServerLed(1, 1, 'stufe2')).toBe(true);
  });

  it('@FU-087 Monotonie: eine ältere Revision, die später ankommt, wird verworfen', () => {
    expect(isServerLed(1, 2, 'stufe2')).toBe(false);
    expect(isServerLed(5, 6, 'stufe2')).toBe(false);
    expect(isServerLed(6, 6, 'stufe2')).toBe(true);
  });

  it('ohne Revision (Spiel gibt es in der Cloud nicht) wird nichts übernommen', () => {
    expect(isServerLed(undefined, undefined, 'stufe2')).toBe(false);
  });

  it('@FU-023 Feldweg: lokal 2:1 ohne Einträge, Cloud 0:0 geplant mit Revision 1 → die Cloud gilt', () => {
    const local = createMockTournament({ id: 'T', matches: [createMockMatch({ id: 'm7', scoreA: 2, scoreB: 1, matchStatus: 'finished' })] });
    const cloud = createMockTournament({ id: 'T', matches: [createMockMatch({ id: 'm7', matchStatus: 'scheduled' })] });

    const merged = mergeServerLedFields(local, cloud, new Map([['m7', 1]]), new Map(), 'stufe2');

    expect(merged.tournament.matches[0]).toMatchObject({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' });
    expect(merged.adopted.get('m7')).toBe(1);
  });
});
