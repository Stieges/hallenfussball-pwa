/**
 * R3-4 (Review #394 H-2): schließt ein anderes Gerät das Turnier ab, folgt die Verwaltung dem Server – ohne Realtime auf `tournaments`
 * durch eine kleine Abfrage alle 15 s. Erwartung aus dem Gherkin (@LZ-009 „Turnier ist abgeschlossen“, Marias zweites Gerät).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const env = vi.hoisted<{ online: boolean; lifecycle: string | null | undefined }>(() => ({ online: true, lifecycle: 'running' }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useIsOnline: () => env.online }));
const read = vi.hoisted(() => vi.fn());
vi.mock('../../../core/repositories/lifecycleRpc', () => ({ readTournamentLifecycle: read }));

import { LIFECYCLE_POLL_MS, useServerLifecyclePoll } from '../hooks/useServerLifecyclePoll';

beforeEach(() => {
  vi.useFakeTimers();
  env.online = true;
  env.lifecycle = 'running';
  read.mockReset();
  read.mockImplementation(() => Promise.resolve(env.lifecycle));
});
afterEach(() => { vi.useRealTimers(); });

const tick = async (ms = LIFECYCLE_POLL_MS) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('Verwaltung folgt dem Server, wenn ein anderes Gerät abschließt', () => {
  it('solange der Server „Läuft“ meldet, passiert nichts; meldet er „abgeschlossen“, lädt die Ansicht neu – genau einmal je Abfrage', async () => {
    const onEnded = vi.fn();
    renderHook(() => useServerLifecyclePoll('t1', true, onEnded));
    await tick();
    expect(read).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled();
    env.lifecycle = 'finished';
    await tick();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiele: ausgeschaltet (kein Recht, Gast, nicht „Läuft“), ohne Netz, ohne Antwort → keine Abfrage bzw. kein Neuladen', async () => {
    const onEnded = vi.fn();
    const aus = renderHook(() => useServerLifecyclePoll('t1', false, onEnded));
    await tick(LIFECYCLE_POLL_MS * 2);
    aus.unmount();
    env.online = false;
    const offline = renderHook(() => useServerLifecyclePoll('t1', true, onEnded));
    await tick(LIFECYCLE_POLL_MS * 2);
    offline.unmount();
    expect(read).not.toHaveBeenCalled();
    env.online = true;
    env.lifecycle = undefined; // keine Antwort
    renderHook(() => useServerLifecyclePoll('t1', true, onEnded));
    await tick(LIFECYCLE_POLL_MS * 2);
    expect(read).toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('beim Ausschalten (Turnier abgeschlossen) endet die Abfrage', async () => {
    const onEnded = vi.fn();
    const { rerender } = renderHook(({ on }) => { useServerLifecyclePoll('t1', on, onEnded); }, { initialProps: { on: true } });
    rerender({ on: false });
    await tick(LIFECYCLE_POLL_MS * 3);
    expect(read).not.toHaveBeenCalled();
  });
});
