/**
 * Abfrage des Zugangsstatus (A-17c): @HE-055 „innerhalb von 3 Sekunden“ (2-s-Takt), @HE-001/@OB-053 (Übergang).
 * Server und Sichtbarkeit sind Attrappen; die Zeit läuft mit Fake-Timern.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { HelperAccessStatus, HelperRpcResult } from '../../../core/repositories/helperAccessRpc';
import { useHelperAccessStatus, type HelperStatusDeps } from '../useHelperAccessStatus';

vi.mock('../../../lib/supabase', () => ({ supabase: null }));

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const ok = (data: HelperAccessStatus): HelperRpcResult<HelperAccessStatus> => ({ ok: true, data });
const accepted: HelperAccessStatus = { state: 'open', relation: 'accepted', field: 2, closed: false, tournament: CUP };
const pending: HelperAccessStatus = { state: 'open', relation: 'pending', checkNumber: 47, tournament: CUP };
const revoked: HelperAccessStatus = { state: 'open', relation: 'revoked', tournament: CUP };

function makeDeps(answers: Array<HelperRpcResult<HelperAccessStatus>>, visible = { value: true }) {
  let i = 0;
  const listeners = new Set<() => void>();
  const deps: HelperStatusDeps = {
    fetchStatus: vi.fn(async () => answers[Math.min(i++, answers.length - 1)]),
    onStatus: vi.fn(),
    isVisible: () => visible.value,
    onBecameVisible: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  return { deps, visible, show: () => { visible.value = true; listeners.forEach((l) => l()); } };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useHelperAccessStatus', () => {
  it('@HE-055 Entzug wird binnen 3 Sekunden sichtbar (Takt 2 s)', async () => {
    const { deps } = makeDeps([ok(accepted), ok(revoked)]);
    const { result } = renderHook(() => useHelperAccessStatus('t-cup', { deps }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.outcome).toEqual({ kind: 'allowed', field: 2 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(result.current.outcome).toEqual({ kind: 'noAccess' });
  });

  it('@HE-001 offene Anfrage bleibt „pending“, bis die Zulassung kommt; dann „allowed“ ohne neuen Scan', async () => {
    const { deps } = makeDeps([ok(pending), ok(pending), ok(accepted)]);
    const { result } = renderHook(() => useHelperAccessStatus('t-cup', { deps }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.outcome).toEqual({ kind: 'pending', checkNumber: 47 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.outcome).toEqual({ kind: 'pending', checkNumber: 47 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.outcome).toEqual({ kind: 'allowed', field: 2 });
  });

  it('Gegenbeispiel: ausgeblendete Seite fragt nicht; beim Zurückkehren sofort', async () => {
    const { deps, visible, show } = makeDeps([ok(accepted)], { value: false });
    renderHook(() => useHelperAccessStatus('t-cup', { deps }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(deps.fetchStatus).not.toHaveBeenCalled();
    expect(visible.value).toBe(false);
    await act(async () => { show(); await vi.advanceTimersByTimeAsync(0); });
    expect(deps.fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Endzustand beendet die Abfrage (kein Dauerfeuer nach Entzug)', async () => {
    const { deps } = makeDeps([ok(revoked)]);
    renderHook(() => useHelperAccessStatus('t-cup', { deps }));
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(deps.fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Netzfehler ändert den Stand nicht und die Abfrage geht weiter', async () => {
    const { deps } = makeDeps([ok(accepted), { ok: false, error: { kind: 'network' } }, ok(accepted)]);
    const { result } = renderHook(() => useHelperAccessStatus('t-cup', { deps }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.outcome).toEqual({ kind: 'allowed', field: 2 });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(deps.fetchStatus).toHaveBeenCalledTimes(3);
    expect(result.current.outcome).toEqual({ kind: 'allowed', field: 2 });
  });

  it('Gegenbeispiel: enabled=false fragt nie', async () => {
    const { deps } = makeDeps([ok(accepted)]);
    renderHook(() => useHelperAccessStatus('t-cup', { deps, enabled: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(deps.fetchStatus).not.toHaveBeenCalled();
  });

  it('führt den Index nach (jede Antwort)', async () => {
    const { deps } = makeDeps([ok(accepted)]);
    renderHook(() => useHelperAccessStatus('t-cup', { deps, deviceUserId: 'anon-tom' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(deps.onStatus).toHaveBeenCalledWith('t-cup', accepted);
  });
});
