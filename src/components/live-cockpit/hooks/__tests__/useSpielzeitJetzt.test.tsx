/** useSpielzeitJetzt (Aufgabe 3.4): die Spielzeit in ms aus der Engine-Uhr, @SL-084 (Spielzeit des ersten Tipps). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { HARNESS_MATCH_ID as MATCH_ID, engineWrapper, laufendesEngineSpiel } from '../../__tests__/engineHarnessSupport';
import { T0 } from '../../__tests__/enginePhaseFixture';
import { useSpielzeitJetzt } from '../useSpielzeitJetzt';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0); });
afterEach(() => { vi.useRealTimers(); });

describe('useSpielzeitJetzt', () => {
  it('@SL-084 3:12 nach dem Anpfiff sind 192 000 ms, bei 3:25 sind es 205 000 ms', async () => {
    const { value } = await laufendesEngineSpiel();
    const { result } = renderHook(() => useSpielzeitJetzt(MATCH_ID), { wrapper: engineWrapper(value) });
    vi.setSystemTime(T0 + 192_000);
    expect(result.current()).toBe(192_000);
    vi.setSystemTime(T0 + 205_000);
    expect(result.current()).toBe(205_000);
  });

  it('Gegenbeispiel: ohne Engine-Kontext oder Spiel ist die Spielzeit 0', () => {
    expect(renderHook(() => useSpielzeitJetzt(MATCH_ID)).result.current()).toBe(0);
    expect(renderHook(() => useSpielzeitJetzt(undefined)).result.current()).toBe(0);
  });
});
