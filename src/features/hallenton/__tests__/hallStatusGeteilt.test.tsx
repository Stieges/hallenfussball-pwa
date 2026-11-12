/**
 * H4-5 geteilte Abfrage `hall_sound_status` je Turnier: drei Einbindungen → eine Abfrage; die letzte Abmeldung beendet sie nach dem
 * Nachlauf (Seitenwechsel verliert nichts, M1); StrictMode, RPC-Fehler und Turnierwechsel (G4). Über den echten Hook `useHallStatus`
 * mit gezähltem RPC-Doppel und falscher Zeit.
 */
import { act, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({ aufrufe: [] as string[], fehler: false, speakers: [] as Array<{ field: number; state: string; ageMs: number; outputHint: boolean }> }));
vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'geraet-1' }));
vi.mock('../../../core/repositories/hallentonRpc', () => ({
  hallSoundStatus: (_c: unknown, args: { p_tournament_id: string }) => {
    rpc.aufrufe.push(args.p_tournament_id);
    return Promise.resolve(rpc.fehler ? { ok: false, grund: 'netz' } : { ok: true, sicht: 'schmal', serverNow: 1, speakers: rpc.speakers });
  },
  hallOutputHeard: vi.fn(), hallTestToneRequest: vi.fn(),
}));

import { __setzeHallStatusFuerTests, useHallStatus } from '../useHallStatus';
import { NACHLAUF_MS } from '../runtime/hallStatusGeteilt';

const weiter = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const bereit = [{ field: 1, state: 'ready', ageMs: 1000, outputHint: false }];

beforeEach(() => { vi.useFakeTimers(); rpc.aufrufe.length = 0; rpc.fehler = false; rpc.speakers = []; });
afterEach(() => { __setzeHallStatusFuerTests(); vi.useRealTimers(); });

describe('H4-5 eine Abfrage je Turnier', () => {
  it('drei Einbindungen desselben Turniers → eine Abfrage je Takt (nicht drei)', async () => {
    const a = renderHook(() => useHallStatus('t1'));
    const b = renderHook(() => useHallStatus('t1'));
    const c = renderHook(() => useHallStatus('t1'));
    await weiter(0);
    expect(rpc.aufrufe).toHaveLength(1);
    await weiter(10_000);
    expect(rpc.aufrufe).toHaveLength(3); // Start + zwei Takte à 5 s
    expect(a.result.current.stand).toBe('aktuell');
    expect(c.result.current.stand).toBe('aktuell');
    a.unmount(); b.unmount(); c.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('die letzte Abmeldung beendet die Abfrage (nach dem Nachlauf); eine Einbindung weniger tut es nicht', async () => {
    const a = renderHook(() => useHallStatus('t2'));
    const b = renderHook(() => useHallStatus('t2'));
    await weiter(0);
    a.unmount();
    await weiter(5000);
    expect(rpc.aufrufe).toHaveLength(2); // läuft weiter
    b.unmount();
    await weiter(NACHLAUF_MS + 1);
    const bis = rpc.aufrufe.length;
    await weiter(30_000);
    expect(rpc.aufrufe).toHaveLength(bis); // beendet
  });

  it('Turniere sind getrennt: je Turnier eine Abfrage', async () => {
    const a = renderHook(() => useHallStatus('t3'));
    const b = renderHook(() => useHallStatus('t4'));
    await weiter(0);
    expect([...rpc.aufrufe].sort()).toEqual(['t3', 't4']);
    a.unmount(); b.unmount();
    await weiter(NACHLAUF_MS + 1);
  });
});

describe('H4-5 Fixrunde 1 M1: Seitenwechsel verliert weder Stand noch „Lautsprecher bekannt“', () => {
  it('mit Netz: Kopfzeile ab, andere an → sofort derselbe Stand, kein leerer Zwischenstand, kein zusätzlicher Aufruf', async () => {
    rpc.speakers = bereit;
    const alt = renderHook(() => useHallStatus('t5'));
    await weiter(0);
    expect(alt.result.current.stand).toBe('aktuell');
    alt.unmount();
    const neu = renderHook(() => useHallStatus('t5')); // Seitenwechsel im selben Zug
    expect(neu.result.current.stand).toBe('aktuell');
    expect(neu.result.current.felder[1]?.art).toBe('bereit');
    await weiter(0);
    expect(rpc.aufrufe).toHaveLength(1);
    neu.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('@HT-041 ohne Netz: nach dem Seitenwechsel weiter „unbekannt“ und „Lautsprecher bekannt“', async () => {
    rpc.speakers = bereit;
    const alt = renderHook(() => useHallStatus('t6'));
    await weiter(0);
    expect(alt.result.current.lautsprecherBekannt).toBe(true);
    rpc.fehler = true;
    await weiter(16_000); // zwei Abfragen scheitern: der Stand ist nicht mehr aktuell
    expect(alt.result.current.stand).toBe('unbekannt');
    alt.unmount();
    const neu = renderHook(() => useHallStatus('t6'));
    expect(neu.result.current.stand).toBe('unbekannt');
    expect(neu.result.current.lautsprecherBekannt).toBe(true);
    neu.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('Gegenbeispiel @HT-038: ohne je einen Lautsprecher bleibt „bekannt“ aus', async () => {
    const h = renderHook(() => useHallStatus('t7'));
    await weiter(0);
    expect(h.result.current.lautsprecherBekannt).toBe(false);
    h.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('nach dem Nachlauf endet die Abfrage und der Stand ist weg („lädt“)', async () => {
    rpc.speakers = bereit;
    const a = renderHook(() => useHallStatus('t8'));
    await weiter(0);
    a.unmount();
    await weiter(NACHLAUF_MS + 1);
    const neu = renderHook(() => useHallStatus('t8'));
    expect(neu.result.current.stand).toBe('laedt');
    neu.unmount();
    await weiter(NACHLAUF_MS + 1);
  });
});

describe('H4-5 Fixrunde 1 G4: StrictMode, RPC-Fehler, Turnierwechsel', () => {
  const streng = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

  it('StrictMode (an/ab/an): eine laufende Abfrage, ein Aufruf je Takt', async () => {
    const h = renderHook(() => useHallStatus('t9'), { wrapper: streng });
    await weiter(0);
    expect(rpc.aufrufe).toHaveLength(1);
    await weiter(5000);
    expect(rpc.aufrufe).toHaveLength(2);
    expect(h.result.current.stand).toBe('aktuell');
    h.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('RPC-Fehler (kein Netz): „unbekannt“, nichts wirft, und die Abfrage versucht es weiter', async () => {
    rpc.fehler = true;
    const h = renderHook(() => useHallStatus('t10'));
    await weiter(0);
    expect(h.result.current.stand).toBe('unbekannt');
    await weiter(10_000);
    expect(rpc.aufrufe.length).toBeGreaterThanOrEqual(3);
    rpc.fehler = false;
    await weiter(5000);
    expect(h.result.current.stand).toBe('aktuell'); // eine Rückkehr mit der nächsten Antwort
    h.unmount();
    await weiter(NACHLAUF_MS + 1);
  });

  it('Turnierwechsel per rerender: das neue Turnier bekommt seine Abfrage, das alte läuft nur nach', async () => {
    const h = renderHook(({ tid }) => useHallStatus(tid), { initialProps: { tid: 't11' } });
    await weiter(0);
    expect(rpc.aufrufe).toEqual(['t11']);
    h.rerender({ tid: 't12' });
    await weiter(0);
    expect(rpc.aufrufe).toEqual(['t11', 't12']);
    await weiter(NACHLAUF_MS + 1);
    const bis = rpc.aufrufe.filter((x) => x === 't11').length;
    await weiter(30_000);
    expect(rpc.aufrufe.filter((x) => x === 't11')).toHaveLength(bis); // t11 beendet
    expect(rpc.aufrufe.filter((x) => x === 't12').length).toBeGreaterThan(3);
    h.unmount();
    await weiter(NACHLAUF_MS + 1);
  });
});
