/**
 * R3-6 Zuschauer-Seite fragt den gespeicherten Endstand im 10-Sekunden-Takt, sobald das Turnier abgeschlossen ist (@LZ-077 Z. 1, @ZM-011,
 * @ZM-069, @ZM-109); davor höchstens einmal beim Öffnen (@ZM-193, Durchsicht Z20). Fake-Timer; die Abfrage ist eine Attrappe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePublicFinalStandings } from '../usePublicFinalStandings';
import { testUuid } from '../../../test/matchSlotFixtures';

const FINAL = {
  status: 'final', finishedAt: '2026-11-28T12:10:00+00:00',
  standings: { format: 1, scorers: [], appVersion: '1', computedAt: '2026-11-28T13:10:00+01:00',
    ranking: [{ place: 1, teamId: testUuid(1), teamName: 'FC Nord', origin: { kind: 'groupPlace', group: '', place: 1 } }] },
};
const advance = async (ms: number): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('usePublicFinalStandings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('@LZ-077 Z. 1: Läuft → Abschluss: nach höchstens 10 Sekunden steht der Endstand da, ohne Neuladen', async () => {
    let reply: unknown = { status: 'none' };
    const read = vi.fn(() => Promise.resolve(reply));
    const { result, rerender } = renderHook(({ finished }) => usePublicFinalStandings('ABC123', true, finished, read), { initialProps: { finished: false } });
    await advance(0);
    expect(result.current.status).toBe('none');
    // der Spielplan-Abruf meldet den Abschluss, der Server hat jetzt den Endstand
    reply = FINAL;
    rerender({ finished: true });
    await advance(0);
    // der Wechsel auf „abgeschlossen“ löst sofort eine Abfrage aus (nicht erst nach einem Takt): zweiter Aufruf, Endstand da
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('final');
    expect(read).toHaveBeenCalledWith('ABC123');
  });

  it('@ZM-193 vor dem Abschluss wird der Endstand nicht im Takt erfragt: einmal beim Öffnen, danach nichts mehr', async () => {
    const read = vi.fn(() => Promise.resolve({ status: 'none' }));
    renderHook(() => usePublicFinalStandings('ABC123', true, false, read));
    await advance(0);
    await advance(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('@ZM-193 Gegenbeispiel: nach dem Abschluss wird er alle 10 Sekunden erfragt (Wechsel ohne Neuladen, @LZ-077)', async () => {
    const read = vi.fn(() => Promise.resolve({ status: 'none' }));
    renderHook(() => usePublicFinalStandings('ABC123', true, true, read));
    await advance(0);
    await advance(30_000);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('@ZM-193 Gegenbeispiel: nach der Rückkehr in den Vordergrund wird auch vor dem Abschluss einmal erfragt', async () => {
    const read = vi.fn(() => Promise.resolve({ status: 'none' }));
    renderHook(() => usePublicFinalStandings('ABC123', true, false, read));
    await advance(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
    expect(read).toHaveBeenCalledTimes(2);
  });

  // Server-Vertrag ab 20261118_008: nach dem Wiederöffnen über den Betreiber dieselbe Antwort wie vorher (Beweis
  // scripts/monitor-endstand-check.sh B3). Vor 20261118_008 meldete der Server dann `none` und der Endstand verschwand.
  it('@ZM-069 @LZ-077 Z. 2: nach dem Wiederöffnen (Turnier nicht abgeschlossen) gilt derselbe Link weiter – der bisherige Endstand bleibt unverändert', async () => {
    const read = vi.fn(() => Promise.resolve(FINAL));
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, false, read));
    await advance(0);
    const vorher = result.current;
    expect(vorher.status).toBe('final');
    await advance(30_000);
    expect(result.current).toEqual(vorher);
    expect(read).toHaveBeenLastCalledWith('ABC123');
  });

  it('Gegenbeispiel: meldet der Server keinen Endstand mehr (z. B. Teilen zurückgenommen, Kindermodus), verschwindet er nach höchstens 10 Sekunden', async () => {
    let reply: unknown = FINAL;
    const read = vi.fn(() => Promise.resolve(reply));
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, true, read));
    await advance(0);
    expect(result.current.status).toBe('final');
    reply = { status: 'none' };
    await advance(10_000);
    expect(result.current.status).toBe('none');
  });

  it('@ZM-109 Gegenbeispiel: eine Störung oder unlesbare Antwort löscht den Endstand nicht', async () => {
    const replies: Array<() => Promise<unknown>> = [() => Promise.resolve(FINAL), () => Promise.reject(new Error('Netz')), () => Promise.resolve({ unsinn: true })];
    const read = vi.fn(() => (replies.shift() ?? (() => Promise.resolve(FINAL)))());
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, true, read));
    await advance(0);
    await advance(10_000);
    await advance(10_000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('final');
  });

  it('ohne geladenes Turnier (enabled aus) wird nicht gefragt', async () => {
    const read = vi.fn(() => Promise.resolve({ status: 'none' }));
    renderHook(() => usePublicFinalStandings('ABC123', false, true, read));
    await advance(30_000);
    expect(read).not.toHaveBeenCalled();
  });
});
