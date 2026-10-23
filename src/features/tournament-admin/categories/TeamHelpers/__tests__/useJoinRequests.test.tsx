/**
 * useJoinRequests (A-18a, S7): Abruf von `list_helper_access` alle 2 s nur bei sichtbarer Seite, Liste immer vom Server.
 * Szenarien: @HE-052 (Übersicht), @HE-062 (kein Recht -> kein weiteres Abfragen), @HE-047 (ohne Netz bleibt die letzte Liste).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const listMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../../core/repositories/helperAccessRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../core/repositories/helperAccessRpc')>()),
  callListHelperAccess: listMock,
}));
vi.mock('../../../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { useJoinRequests, JOIN_REQUESTS_POLL_MS } from '../useJoinRequests';

const LIST = { requests: [], members: [] };

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useJoinRequests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listMock.mockReset();
    listMock.mockResolvedValue({ ok: true, data: LIST });
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fragt sofort ab und danach alle 2 Sekunden (R-GA5-6)', async () => {
    const { result } = renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock.mock.calls[0]?.[1]).toBe('t1');
    expect(result.current.loadState).toBe('ready');
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS); });
    expect(listMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS); });
    expect(listMock).toHaveBeenCalledTimes(3);
  });

  it('Gegenbeispiel: bei versteckter Seite wird nicht abgefragt, beim Zurückkommen sofort', async () => {
    setVisibility('hidden');
    renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS * 3); });
    expect(listMock).not.toHaveBeenCalled();
    await act(async () => { setVisibility('visible'); await vi.advanceTimersByTimeAsync(0); });
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel (@HE-062): ohne Recht (42501) wird nicht weiter abgefragt, die Seite meldet noRight', async () => {
    listMock.mockResolvedValue({ ok: false, error: { kind: 'notAuthorized' } });
    const { result } = renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.loadState).toBe('noRight');
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS * 5); });
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: deaktiviert fragt der Hook nie ab (Helfer ohne Recht sieht die Seite nicht)', async () => {
    renderHook(() => useJoinRequests('t1', false));
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS * 3); });
    expect(listMock).not.toHaveBeenCalled();
  });

  it('@HE-047: ein Netzfehler behält die letzte Liste und setzt offline; der nächste Abruf holt sie wieder', async () => {
    const withTom = { requests: [], members: [{ memberId: 'm1', name: 'Tom', deviceLabel: 'phone', field: 2, mode: 'helper', revokedAt: null, acceptedAt: 'x', lastSeenAt: null, controls: [] }] };
    listMock.mockResolvedValueOnce({ ok: true, data: withTom });
    listMock.mockResolvedValueOnce({ ok: false, error: { kind: 'network' } });
    const { result } = renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.list?.members).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS); });
    expect(result.current.offline).toBe(true);
    expect(result.current.list?.members).toHaveLength(1);
    listMock.mockResolvedValue({ ok: true, data: LIST });
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS); });
    expect(result.current.offline).toBe(false);
    expect(result.current.list?.members).toHaveLength(0);
  });

  it('refresh() holt die Liste vom Server (nach Zulassen/Entziehen), nie aus dem Speicher', async () => {
    const { result } = renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    listMock.mockClear();
    await act(async () => { await result.current.refresh(); });
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('beim Verlassen der Seite stoppt das Abfragen', async () => {
    const { unmount } = renderHook(() => useJoinRequests('t1', true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    listMock.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(JOIN_REQUESTS_POLL_MS * 3); });
    expect(listMock).not.toHaveBeenCalled();
  });
});
