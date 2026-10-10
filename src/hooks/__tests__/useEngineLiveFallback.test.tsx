/**
 * A-06k (@FU-025): Ist der Realtime-Kanal eines Turniers unterbrochen (nicht SUBSCRIBED), ruft
 * `useEngineLiveFallback` alle 5 s `engine.catchUpLoaded()` auf -- Ausweichen auf Abfrage.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEngineLiveFallback } from '../useEngineLiveFallback';
import { setRealtimeChannelStatus, clearRealtimeChannelStatus } from '../realtimeChannelStatus';

const TOURNAMENT = 'tour-live-fallback';

function makeEngine() {
  return { catchUpLoaded: vi.fn().mockResolvedValue(undefined) };
}

function setup(enabled: boolean, engine = makeEngine()) {
  const hook = renderHook(
    ({ on, eng }: { on: boolean; eng: { catchUpLoaded(): Promise<void> } }) =>
      useEngineLiveFallback(eng, on, TOURNAMENT),
    { initialProps: { on: enabled, eng: engine } },
  );
  return { ...hook, engine };
}

describe('useEngineLiveFallback (A-06k, @FU-025)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    clearRealtimeChannelStatus(TOURNAMENT);
    vi.useRealTimers();
  });

  it('CLOSED: catchUpLoaded laeuft nach 5 s einmal und nach 10 s mindestens zweimal', async () => {
    const { engine } = setup(true);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CLOSED'));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('CHANNEL_ERROR und TIMED_OUT gelten ebenfalls als Unterbrechung', async () => {
    const engine = makeEngine();
    setup(true, engine);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CHANNEL_ERROR'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'TIMED_OUT'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('Gegenbeispiel SUBSCRIBED: kein catchUpLoaded-Intervall', async () => {
    const { engine } = setup(true);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'SUBSCRIBED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

    expect(engine.catchUpLoaded).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel noch kein Status gemeldet: kein catchUpLoaded', async () => {
    const { engine } = setup(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

    expect(engine.catchUpLoaded).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel Gast (enabled=false): auch bei CLOSED nichts', async () => {
    const { engine } = setup(false);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

    expect(engine.catchUpLoaded).not.toHaveBeenCalled();
  });

  it('Unmount loescht das Intervall', async () => {
    const { engine, unmount } = setup(true);

    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CLOSED'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);
  });

  it('RACE: CLOSED -> SUBSCRIBED -> CLOSED schnell hintereinander ergibt genau EIN Intervall', async () => {
    const engine = makeEngine();
    setup(true, engine);

    // Drei getrennte Ereignisse (je eigenes act), damit React die Wechsel nicht zusammenfasst.
    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CLOSED'));
    act(() => setRealtimeChannelStatus(TOURNAMENT, 'SUBSCRIBED'));
    act(() => setRealtimeChannelStatus(TOURNAMENT, 'CLOSED'));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(engine.catchUpLoaded).toHaveBeenCalledTimes(1);
  });
});

