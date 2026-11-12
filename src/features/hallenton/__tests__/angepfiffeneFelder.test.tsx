/**
 * H4-5 Fixrunde 1 (H1, @HT-035 letzte Zeile): „Handy ohne Netz“ nur auf Feldern mit angepfiffenem Spiel. Rein und über den Hook
 * (lokaler Plan, Status nach der Engine, sonst nach der Kopie).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlanSpiel } from '../runtime/feldStandSpiele';
import { angepfiffeneFelder } from '../runtime/angepfiffeneFelder';

const spiel = (id: string, field: number, status?: PlanSpiel['status']): PlanSpiel => ({ id, field, matchNumber: 1, status, ctx: null });

describe('@HT-035 angepfiffeneFelder', () => {
  it('läuft oder pausiert ein Spiel auf Feld 1 → Feld 1; beendet oder offen → kein Feld', () => {
    expect([...angepfiffeneFelder([spiel('a', 1, 'RUNNING'), spiel('b', 2, 'FINISHED'), spiel('c', 3)], () => undefined)]).toEqual([1]);
    expect([...angepfiffeneFelder([spiel('a', 1, 'PAUSED')], () => undefined)]).toEqual([1]);
    expect(angepfiffeneFelder([spiel('a', 1, 'FINISHED')], () => undefined).size).toBe(0);
  });
  it('die Engine geht vor der Kopie: Kopie „läuft“, Engine „beendet“ → nicht angepfiffen; umgekehrt angepfiffen', () => {
    expect(angepfiffeneFelder([spiel('a', 1, 'RUNNING')], () => 'finished').size).toBe(0);
    expect([...angepfiffeneFelder([spiel('a', 1)], () => 'running')]).toEqual([1]);
  });
});

const turnier = vi.hoisted((): { wert: object | null } => ({ wert: null }));
const engine = vi.hoisted(() => ({ status: undefined as string | undefined, hoerer: [] as Array<() => void> }));
vi.mock('../runtime/lokalerSpielplan', () => ({
  planAusTurnier: (t: { matches: Array<{ id: string; field: number; matchStatus: 'running' | 'finished' }> }) =>
    t.matches.map((m) => ({ id: m.id, field: m.field, matchNumber: 1, status: m.matchStatus === 'running' ? 'RUNNING' : 'FINISHED', ctx: null })),
}));
vi.mock('../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(turnier.wert) }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => ctx,
}));
const ctx = {
  engine: {
    view: () => (engine.status === undefined ? null : { result: { state: { status: engine.status } } }),
    subscribe: (fn: () => void) => { engine.hoerer.push(fn); return () => undefined; },
  },
};

import { useAngepfiffeneFelder } from '../useAngepfiffeneFelder';

describe('@HT-035 useAngepfiffeneFelder', () => {
  it('Plan aus der lokalen Kopie: läuft Spiel 11 auf Feld 1, ist Feld 1 dabei; nach dem Ende der Engine nicht mehr', async () => {
    turnier.wert = { matches: [{ id: 'm11', field: 1, matchStatus: 'running' }] };
    engine.status = undefined;
    const h = renderHook(() => useAngepfiffeneFelder('t1'));
    await act(async () => { await Promise.resolve(); });
    expect([...h.result.current]).toEqual([1]);
    engine.status = 'finished';
    await act(async () => { engine.hoerer.forEach((fn) => fn()); await Promise.resolve(); });
    expect(h.result.current.size).toBe(0);
  });
});
