/**
 * R5 PR 1 „Sofort-Kanal“ – Lade-Hook des Monitors (Fake-Timer, eingespeiste Quelle mit Signal).
 * Testwerte aus dem Gherkin: @ZM-084 Zeile „Tom trägt in Spiel 7 ein Tor für FC Nord ein → nach höchstens 1 Sekunde
 * Stand 2:0“, @FU-001 (Monitor 2 s auch bei Signalverlust), @ZM-083 Zeile Feld 2 („Einblendung und gleichzeitig der
 * neue Stand“), @ZM-123 (aus dem Hintergrund sofort aktuell, nie Spiel 7 als laufend), Plan R5 § 4 PR 1 Tests 1–3, 7, 8.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { PERFORMANCE_PROFILES, type TournamentMonitor } from '../../../types/monitor';
import type { DisplayDelta, MonitorDataSource } from '../monitorDataSource';
import { MIN_FETCH_GAP_MS, useMonitorDisplayData } from '../useMonitorDisplayData';
import { getPerformanceSettings } from '../monitorDisplayHelpers';
import { attachMonitor, buildTournament, slide, withMatch, withMonitor } from './monitorFixture';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const target = { tournamentId: 'tour-1', monitorId: 'mon-1' };
/** Rückfall-Takt wie die Seite: Profil des Monitors. */
const profilTakt = (m: TournamentMonitor | null): number =>
  m ? getPerformanceSettings(m.performanceMode).pollingInterval : PERFORMANCE_PROFILES.high.pollingInterval;

function stand(scoreA: number, monitor = withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] })): Tournament {
  return attachMonitor(buildTournament({ matches: withMatch('match-7', { scoreA, scoreB: 0, matchStatus: 'running' }) }), monitor);
}

function snapshot(t: Tournament): DisplayDelta {
  return { kind: 'snapshot', version: '1', tournament: t, monitor: t.monitors?.[0] ?? null, origin: 'cloud', lookupFailed: false };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

/** Quelle mit steuerbarem Signal. */
function quelle(fetch: MonitorDataSource['fetch']) {
  let signal: (() => void) | null = null;
  const unsubscribe = vi.fn();
  const source: MonitorDataSource = {
    fetch,
    subscribe: (onChange) => { signal = onChange; return unsubscribe; },
  };
  return { source, unsubscribe, signal: () => { signal?.(); } };
}

const score7 = (t: Tournament | null) => t?.matches.find((m) => m.id === 'match-7')?.scoreA;

describe('R5 Sofort-Kanal: useMonitorDisplayData', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('@ZM-084 Z1: Signal -> Abruf im selben Tick, Stand 2:0 ohne auf den Takt zu warten', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(stand(1))).mockResolvedValue(snapshot(stand(2)));
    const q = quelle(fetch);
    const { result } = renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(score7(result.current.tournament)).toBe(1);

    act(() => { q.signal(); });
    expect(fetch).toHaveBeenCalledTimes(2); // im selben Tick, kein Timer dazwischen
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(score7(result.current.tournament)).toBe(2);
  });

  it('Gegenbeispiel: ohne Signal kommt 2:0 erst mit dem Rückfall-Takt (2 s)', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(stand(1))).mockResolvedValue(snapshot(stand(2)));
    const q = quelle(fetch);
    const { result } = renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(score7(result.current.tournament)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(score7(result.current.tournament)).toBe(2);
  });

  it('Plan Test 2: Signal während eines laufenden Abrufs -> genau ein Nachabruf (früher verworfen)', async () => {
    const haengt = deferred<DisplayDelta>();
    const fetch = vi.fn<MonitorDataSource['fetch']>()
      .mockResolvedValueOnce(snapshot(stand(1)))
      .mockReturnValueOnce(haengt.promise)
      .mockResolvedValue(snapshot(stand(3)));
    const q = quelle(fetch);
    const { result } = renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => { q.signal(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    act(() => { q.signal(); q.signal(); q.signal(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { haengt.resolve(snapshot(stand(2))); await vi.advanceTimersByTimeAsync(0); });
    // Nachabruf nach der Drossel (>= 250 ms seit dem Beginn des laufenden Abrufs)
    await act(async () => { await vi.advanceTimersByTimeAsync(MIN_FETCH_GAP_MS); });
    expect(fetch).toHaveBeenCalledTimes(3); // vier Signale -> ein Nachabruf
    expect(score7(result.current.tournament)).toBe(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetch).toHaveBeenCalledTimes(3); // kein zweiter Nachabruf (Takt erst bei 2 s)
  });

  it('Drossel: Signal-Flut startet Abrufe frühestens alle 250 ms', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot(stand(1)));
    const q = quelle(fetch);
    renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => { q.signal(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 10; i++) { act(() => { q.signal(); }); }
    await act(async () => { await vi.advanceTimersByTimeAsync(MIN_FETCH_GAP_MS - 1); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([['high'], ['low']] as const)('Plan Test 3 / @FU-001: Kanal tot -> Abruf alle 2 s im Profil %s', async (mode) => {
    const t = stand(1, withMonitor({ performanceMode: mode }));
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot(t));
    const q = quelle(fetch);
    renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('@ZM-083 Feld 2: Einblendung und neuer Stand im selben Render; nach dem Ende der Einblendung bleibt der Stand', async () => {
    const feld1 = withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] });
    const neu = deferred<DisplayDelta>();
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(stand(1, feld1))).mockReturnValueOnce(neu.promise);
    const q = quelle(fetch);
    const renders: Array<{ score: number | undefined; goal: string | null }> = [];
    const { result } = renderHook(() => {
      const data = useMonitorDisplayData(q.source, target, profilTakt);
      renders.push({ score: score7(data.tournament), goal: data.goalEvent?.teamName ?? null });
      return data;
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => { q.signal(); });
    // Nur Mikrotasks leeren, KEINE Timer: eine Einblendung, die erst einen Takt nach dem Stand käme, fehlt hier.
    await act(async () => { neu.resolve(snapshot(stand(2, feld1))); await Promise.resolve(); await Promise.resolve(); });
    expect(renders.filter((r) => r.score === 2 && r.goal === null)).toEqual([]);
    expect(renders.find((r) => r.score === 2)).toEqual({ score: 2, goal: 'FC Nord' });
    act(() => { result.current.clearGoalEvent(); });
    expect(result.current.goalEvent).toBeNull();
    expect(score7(result.current.tournament)).toBe(2);
  });

  it('Plan Test 7: erstes Laden mit Toren blendet nichts ein; Korrektur 2:0 -> 1:0 auch nicht', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(stand(3))).mockResolvedValue(snapshot(stand(1)));
    const q = quelle(fetch);
    const { result } = renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(score7(result.current.tournament)).toBe(3);
    expect(result.current.goalEvent).toBeNull();
    act(() => { q.signal(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(score7(result.current.tournament)).toBe(1);
    expect(result.current.goalEvent).toBeNull();
  });

  it('Ziel-Wechsel: der erste Stand des neuen Ziels blendet nichts ein', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(stand(1))).mockResolvedValue(snapshot(stand(4)));
    const q = quelle(fetch);
    const { result, rerender } = renderHook(({ id }) => useMonitorDisplayData(q.source, { tournamentId: 'tour-1', monitorId: id }, profilTakt), { initialProps: { id: 'mon-1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    rerender({ id: 'mon-2' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(score7(result.current.tournament)).toBe(4);
    expect(result.current.goalEvent).toBeNull();
  });

  it('@ZM-123: Fenster wieder sichtbar -> sofort abrufen; danach nie Spiel 7 als laufend', async () => {
    const vorher = stand(1);
    const nachher = attachMonitor(buildTournament({ matches: withMatch('match-7', { scoreA: 3, scoreB: 1, matchStatus: 'finished' }) }), vorher.monitors![0]);
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(snapshot(vorher)).mockResolvedValue(snapshot(nachher));
    const q = quelle(fetch);
    const { result } = renderHook(() => useMonitorDisplayData(q.source, target, () => 600_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.tournament?.matches.find((m) => m.id === 'match-7')?.matchStatus).toBe('finished');
  });

  it('Netz zurück (online) -> sofort abrufen', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot(stand(1)));
    const q = quelle(fetch);
    renderHook(() => useMonitorDisplayData(q.source, target, () => 600_000));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Abmelden beim Unmount', async () => {
    const q = quelle(vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot(stand(1))));
    const { unmount } = renderHook(() => useMonitorDisplayData(q.source, target, profilTakt));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    expect(q.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('@FU-001 Rückfall-Takt beider Profile ist 2 s', () => {
    expect([PERFORMANCE_PROFILES.high.pollingInterval, PERFORMANCE_PROFILES.low.pollingInterval]).toEqual([2_000, 2_000]);
  });
});
