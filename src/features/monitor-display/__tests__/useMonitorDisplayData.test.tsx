/** B-16b2 – Lade- und Poll-Hook des Monitors: Race-, Zeit- und Ziel-Wechsel-Fälle (Fake-Timer, eingespeiste Quelle). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { TournamentMonitor } from '../../../types/monitor';
import type { DisplayDelta, MonitorDataSource } from '../monitorDataSource';
import { useMonitorDisplayData, type MonitorDisplayTarget } from '../useMonitorDisplayData';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const tournament = { id: 'tour-1', title: 'Turnier', teams: [], matches: [] } as unknown as Tournament;
const monitor = { id: 'mon-1', name: 'Haupthalle', performanceMode: 'low' } as unknown as TournamentMonitor;

const snapshot = (over: Partial<Extract<DisplayDelta, { kind: 'snapshot' }>> = {}): DisplayDelta => ({
  kind: 'snapshot',
  version: null,
  tournament,
  monitor,
  origin: 'cloud',
  lookupFailed: false,
  ...over,
});

const target = (tournamentId = 'tour-1', monitorId = 'mon-1'): MonitorDisplayTarget => ({ tournamentId, monitorId });

const pollFor5s = () => 5_000;
const pollFor = (m: TournamentMonitor | null) => (m ? 10_000 : 5_000);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('useMonitorDisplayData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // R5 PR 1 (Plan Test 2): ein Anstoß während eines laufenden Abrufs wird nicht mehr verworfen, sondern als genau EIN
  // Nachabruf vorgemerkt (vorher: Tick übersprungen, nächster Abruf erst beim übernächsten Takt).
  it('gleichzeitiger Abruf: Poll-Tick während eines hängenden Abrufs startet keinen zweiten; nach resolve genau ein Nachabruf', async () => {
    const pending = deferred<DisplayDelta>();
    const fetch = vi.fn<MonitorDataSource['fetch']>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(snapshot());
    const source: MonitorDataSource = { fetch };

    renderHook(() => useMonitorDisplayData(source, target(), pollFor5s));
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { pending.resolve(snapshot()); await vi.advanceTimersByTimeAsync(0); });
    // Der Tick bei 5 000 ms war vorgemerkt: genau ein Nachabruf direkt nach der Antwort, kein zweiter.
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(fetch).toHaveBeenCalledTimes(2);
    // Tick bei 10 000 ms wie gewohnt.
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('Intervall ohne Monitor: 4999 ms kein zweiter Aufruf, 5000 ms ja', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot({ monitor: null }));
    const source: MonitorDataSource = { fetch };
    renderHook(() => useMonitorDisplayData(source, target(), pollFor));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Intervall mit Monitor (Profil 10 000 ms): 9999 ms kein Aufruf, 10 000 ms ja', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot());
    const source: MonitorDataSource = { fetch };
    renderHook(() => useMonitorDisplayData(source, target(), pollFor));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(9_999); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Unmount räumt das Intervall: nach Unmount + 60 s kein Aufruf mehr', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot());
    const source: MonitorDataSource = { fetch };
    const { unmount } = renderHook(() => useMonitorDisplayData(source, target(), pollFor5s));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const before = fetch.mock.calls.length;

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetch).toHaveBeenCalledTimes(before);
  });

  it('späte Antwort nach Unmount setzt keinen Zustand und meldet keinen Konsolenfehler', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = deferred<DisplayDelta>();
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockReturnValue(pending.promise);
    const source: MonitorDataSource = { fetch };
    const { unmount } = renderHook(() => useMonitorDisplayData(source, target(), pollFor5s));

    unmount();
    await act(async () => { pending.resolve(snapshot()); await vi.advanceTimersByTimeAsync(0); });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('Ziel-Wechsel: fehlt das neue Turnier nach einem echten Fehler, ist der Fehlertext sichtbar (nicht unterdrückt)', async () => {
    const fetchT1 = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot());
    const fetchT2 = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue({ kind: 'missing', lookupFailed: true });
    const { result, rerender } = renderHook(
      ({ src, t }: { src: MonitorDataSource; t: MonitorDisplayTarget }) => useMonitorDisplayData(src, t, pollFor5s),
      { initialProps: { src: { fetch: fetchT1 }, t: target('tour-1') } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.hasData).toBe(true);

    rerender({ src: { fetch: fetchT2 }, t: target('tour-2') });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.error).toMatch(/Verbindung zum Server fehlgeschlagen/);
    expect(result.current.loading).toBe(false);
  });

  it('Ziel-Wechsel nach Cloud-Erfolg: bis zur Antwort bleiben origin und Turnier stehen (Realtime nicht abgemeldet)', async () => {
    const pendingT2 = deferred<DisplayDelta>();
    const fetchT1 = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot());
    const fetchT2 = vi.fn<MonitorDataSource['fetch']>().mockReturnValue(pendingT2.promise);
    const { result, rerender } = renderHook(
      ({ src, t }: { src: MonitorDataSource; t: MonitorDisplayTarget }) => useMonitorDisplayData(src, t, pollFor5s),
      { initialProps: { src: { fetch: fetchT1 }, t: target('tour-1') } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.origin).toBe('cloud');
    const altesTurnier = result.current.tournament;

    rerender({ src: { fetch: fetchT2 }, t: target('tour-2') });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetchT2).toHaveBeenCalledTimes(1);
    expect(result.current.hasData).toBe(false);
    expect(result.current.origin).toBe('cloud');
    expect(result.current.tournament).toBe(altesTurnier);

    await act(async () => { pendingT2.resolve(snapshot()); await vi.advanceTimersByTimeAsync(0); });
  });

  it('gleiche Quelle bei rerender: kein zusätzlicher Abruf', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValue(snapshot());
    const src: MonitorDataSource = { fetch };
    const { rerender } = renderHook(
      ({ s }: { s: MonitorDataSource }) => useMonitorDisplayData(s, target(), pollFor5s),
      { initialProps: { s: src } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);

    rerender({ s: src });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('version aus dem letzten snapshot geht an den nächsten fetch; Ziel-Wechsel setzt sie auf null', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>()
      .mockResolvedValueOnce(snapshot({ version: 'v1' }))
      .mockResolvedValue(snapshot({ version: 'v2' }));
    const source: MonitorDataSource = { fetch };
    const { rerender } = renderHook(
      ({ t }: { t: MonitorDisplayTarget }) => useMonitorDisplayData(source, t, pollFor5s),
      { initialProps: { t: target('tour-1') } }
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(fetch).toHaveBeenNthCalledWith(2, 'v1');

    rerender({ t: target('tour-2') });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const lastCall = fetch.mock.calls[fetch.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });
});
