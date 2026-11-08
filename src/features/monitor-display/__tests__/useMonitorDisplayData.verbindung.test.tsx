/**
 * Paket M · Monitor-Stabilität – eingefrorene Verbindung (@ME-030 Zeile „Antwort bleibt aus … 30 Sekunden“, @ZM-085, @ME-007).
 * Gherkin: bleibt die Antwort des Servers 30 Sekunden aus, obwohl der Browser Netz meldet, erkennt der Monitor das und zeigt
 * „Stand von hh:mm“ (Serverzeit des letzten Stands); kommt wieder eine Antwort, verschwindet der Hinweis. Fake-Timer, eingespeiste Quelle.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PERFORMANCE_PROFILES, type TournamentMonitor } from '../../../types/monitor';
import type { DisplayDelta, MonitorDataSource } from '../monitorDataSource';
import { useMonitorDisplayData } from '../useMonitorDisplayData';
import { VERBINDUNG_NACH_MS } from '../useMonitorVerbindung';
import { getPerformanceSettings } from '../monitorDisplayHelpers';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

const target = { tournamentId: 'tour-1', monitorId: 'mon-1' };
const profilTakt = (m: TournamentMonitor | null): number =>
  m ? getPerformanceSettings(m.performanceMode).pollingInterval : PERFORMANCE_PROFILES.high.pollingInterval;

/** 14:32 Ortszeit (Europe/Berlin, im November UTC+1) = 13:32 UTC */
const UM_1432 = Date.UTC(2026, 10, 28, 13, 32, 0);

const turnier = attachMonitor(buildTournament(), withMonitor({ slides: [slide('live', { fieldId: 'field-1' })] }));
const stand: DisplayDelta = { kind: 'snapshot', version: '1', tournament: turnier, monitor: turnier.monitors?.[0] ?? null, origin: 'cloud', lookupFailed: false };
const unveraendert: DisplayDelta = { kind: 'unchanged' };
/** Cloud gescheitert, lokale Kopie als Rückfall: das ist keine Antwort des Servers */
const nurLokal: DisplayDelta = { ...stand, origin: 'local', lookupFailed: true };

/** Quelle, deren Serverzeit mit der (gefälschten) Geräteuhr läuft; um 14:32 ist die erste Antwort da. */
function quelle(fetch: MonitorDataSource['fetch']): MonitorDataSource {
  return { fetch, nowMs: () => Date.now() };
}

async function vor(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('Paket M: eingefrorene Verbindung am Monitor (@ME-030, @ZM-085)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(UM_1432); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('@ME-030: solange Antworten kommen, auch unveränderte, gibt es keinen Hinweis', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(stand).mockResolvedValue(unveraendert);
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    expect(result.current.hasData).toBe(true);
    await vor(VERBINDUNG_NACH_MS * 3);
    expect(result.current.verbindung).toBeNull();
  });

  it('@ME-030: die Antwort bleibt aus (Abruf hängt) – nach 29 Sekunden noch kein Hinweis, nach 30 Sekunden „Stand von 14:32“', async () => {
    const haengt = new Promise<DisplayDelta>(() => undefined);
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(stand).mockReturnValue(haengt);
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    await vor(VERBINDUNG_NACH_MS - 1_000);
    expect(result.current.verbindung).toBeNull();
    await vor(1_000);
    expect(result.current.verbindung).toEqual({ standMs: UM_1432 });
    // der Monitor zeigt dabei weiter den letzten Stand, er wird nicht leer
    expect(result.current.hasData).toBe(true);
    expect(result.current.tournament).not.toBeNull();
  });

  it('@ME-030: der Abruf scheitert (Fehler, Zeitgrenze) – derselbe Hinweis nach 30 Sekunden', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(stand).mockRejectedValue(new Error('Zeitgrenze'));
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    await vor(VERBINDUNG_NACH_MS - 1_000);
    expect(result.current.verbindung).toBeNull();
    await vor(1_000);
    expect(result.current.verbindung).toEqual({ standMs: UM_1432 });
  });

  it('@ZM-085: gescheiterte Cloud-Abfrage mit lokaler Kopie als Rückfall zählt nicht als Antwort', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockResolvedValueOnce(stand).mockResolvedValue(nurLokal);
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    await vor(VERBINDUNG_NACH_MS);
    expect(result.current.verbindung).toEqual({ standMs: UM_1432 });
  });

  it('@ME-007: nach der Rückkehr der Antwort ist der Hinweis sofort weg; „Stand von“ nennt beim nächsten Ausfall den neuen Zeitpunkt', async () => {
    let netz = false;
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockImplementation(async () => {
      if (!netz) { throw new Error('kein Netz'); }
      return unveraendert;
    });
    fetch.mockResolvedValueOnce(stand);
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    await vor(VERBINDUNG_NACH_MS);
    expect(result.current.verbindung).not.toBeNull();

    netz = true;
    await vor(PERFORMANCE_PROFILES.high.pollingInterval);
    expect(result.current.verbindung).toBeNull();

    // erneuter Ausfall: die Frist beginnt mit der letzten Antwort
    const letzte = Date.now();
    netz = false;
    await vor(VERBINDUNG_NACH_MS - 2_000);
    expect(result.current.verbindung).toBeNull();
    await vor(4_000);
    expect(result.current.verbindung?.standMs).toBeGreaterThanOrEqual(letzte - 2_000);
    expect(result.current.verbindung?.standMs).toBeLessThanOrEqual(letzte + 2_000);
  });

  it('Gegenbeispiel: ein einzelner Aussetzer von 10 Sekunden bleibt still', async () => {
    let netz = true;
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockImplementation(async () => {
      if (!netz) { throw new Error('Aussetzer'); }
      return unveraendert;
    });
    fetch.mockResolvedValueOnce(stand);
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(0);
    netz = false;
    await vor(10_000);
    expect(result.current.verbindung).toBeNull();
    netz = true;
    await vor(5_000);
    await vor(VERBINDUNG_NACH_MS);
    expect(result.current.verbindung).toBeNull();
  });

  it('Gegenbeispiel: ohne je einen Stand gibt es keinen Hinweis (dort steht „Warte auf Verbindung“, @ME-009)', async () => {
    const fetch = vi.fn<MonitorDataSource['fetch']>().mockRejectedValue(new Error('kein Netz'));
    const { result } = renderHook(() => useMonitorDisplayData(quelle(fetch), target, profilTakt));
    await vor(VERBINDUNG_NACH_MS * 2);
    expect(result.current.hasData).toBe(false);
    expect(result.current.verbindung).toBeNull();
  });
});
