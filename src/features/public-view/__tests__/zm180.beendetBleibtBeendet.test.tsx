/**
 * @ZM-180 Ein beendetes Spiel bleibt auf der Zuschauer-Seite beendet, auch wenn ein älterer Stand nachkommt
 * (Offline-Speicher und verspätete Antwort). Szenario: „Ein beendetes Spiel bleibt auf jeder Anzeige beendet …“.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Match, Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { usePublicTournament, PUBLIC_FETCH_TIMEOUT_MS } from '../usePublicTournament';
import type { PublicFetchResult, PublicTournamentSource } from '../publicSource';
import { saveStand, loadStand, type StandStorage } from '../publicStandStore';

/** 10.10.2026 14:32 Ortszeit des Turniers */
const AT_1432 = new Date('2026-10-10T12:32:00Z');
const TODAY = '2026-10-10';

function memoryStorage(): StandStorage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const match7 = (tournament: Tournament | null): Match | undefined => tournament?.matches.find((m) => m.matchNumber === 7);
function spiel7(tournament: Tournament, patch: Pick<Match, 'matchStatus' | 'scoreA' | 'scoreB'>): Tournament {
  return { ...tournament, matches: tournament.matches.map((m) => (m.matchNumber === 7 ? { ...m, ...patch } : m)) };
}
const beendet21 = (): Tournament => spiel7(buildLiveViewTournament(), { matchStatus: 'finished', scoreA: 2, scoreB: 1 });
const laeuft11 = (): Tournament => spiel7(buildLiveViewTournament(), { matchStatus: 'running', scoreA: 1, scoreB: 1 });
const korrektur31 = (): Tournament => spiel7(buildLiveViewTournament(), { matchStatus: 'finished', scoreA: 3, scoreB: 1 });

function offlineSource(kind: PublicTournamentSource['kind']): PublicTournamentSource {
  return { kind, pollIntervalMs: 10_000, nowMs: () => Date.now(), fetch: vi.fn(() => Promise.resolve<PublicFetchResult>({ kind: 'unreachable' })) };
}
const stand = (tournament: Tournament, version: string) => ({ source: 'rpc' as const, version, day: TODAY, tournament });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AT_1432);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
});

async function reloadOffline(storage: StandStorage) {
  const hook = renderHook(() => usePublicTournament(SHARE_CODE, offlineSource('rpc'), { storage }));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return hook.result.current;
}

describe('@ZM-180 Offline-Speicher der Zuschauer-Seite', () => {
  it('@ZM-180 Speicher hält Spiel 7 beendet 2:1 (Version 200); ein Tab speichert danach Version 100 mit 1:1 läuft; Neuladen ohne Netz zeigt Spiel 7 beendet 2:1', async () => {
    const storage = memoryStorage();
    saveStand(storage, SHARE_CODE, stand(beendet21(), '200'));
    saveStand(storage, SHARE_CODE, stand(laeuft11(), '100'));

    const state = await reloadOffline(storage);
    expect(match7(state.tournament)).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 1 });
  });

  it('@ZM-180 Gegenbeispiel: eine neuere Version 300 mit Korrektur 3:1 wird gespeichert', async () => {
    const storage = memoryStorage();
    saveStand(storage, SHARE_CODE, stand(beendet21(), '200'));
    saveStand(storage, SHARE_CODE, stand(korrektur31(), '300'));

    const state = await reloadOffline(storage);
    expect(match7(state.tournament)).toMatchObject({ matchStatus: 'finished', scoreA: 3, scoreB: 1 });
  });

  it('@ZM-180 Quelle legacy (Fingerabdruck ohne Reihenfolge): der letzte Abruf gilt wie bisher', () => {
    const storage = memoryStorage();
    saveStand(storage, SHARE_CODE, { ...stand(beendet21(), 'zz'), source: 'legacy' });
    saveStand(storage, SHARE_CODE, { ...stand(laeuft11(), 'aa'), source: 'legacy' });

    expect(match7(loadStand(storage, SHARE_CODE, TODAY, 'legacy')?.stand.tournament ?? null)?.matchStatus).toBe('running');
  });

  it('@ZM-180 Tabelle: Spiel 7 zählt nach dem Neuladen weiter mit 2:1', async () => {
    const storage = memoryStorage();
    saveStand(storage, SHARE_CODE, stand(beendet21(), '200'));
    saveStand(storage, SHARE_CODE, stand(laeuft11(), '100'));

    const state = await reloadOffline(storage);
    expect(state.standings).toEqual(calculateStandingsPerGroup(beendet21()));
  });
});

describe('@ZM-180 verspätete Antwort eines älteren Abrufs', () => {
  function hookWithLateReply() {
    const late: { resolve: (result: PublicFetchResult) => void } = { resolve: () => undefined };
    const results: Array<PublicFetchResult | Promise<PublicFetchResult>> = [
      { kind: 'full', version: '200', tournament: beendet21() },
      new Promise<PublicFetchResult>((resolve) => { late.resolve = resolve; }),
      { kind: 'unchanged', version: '200' },
    ];
    const source: PublicTournamentSource = {
      kind: 'rpc', pollIntervalMs: 10_000, nowMs: () => Date.now(),
      fetch: vi.fn(() => Promise.resolve(results.shift() ?? { kind: 'unreachable' as const })),
    };
    return { late, hook: renderHook(() => usePublicTournament(SHARE_CODE, source, { storage: null })) };
  }

  it('@ZM-180 gehalten beendet 2:1, die späte Antwort eines älteren Abrufs mit 1:1 ändert nichts; die Tabelle rechnet mit 2:1', async () => {
    const { late, hook } = hookWithLateReply();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(match7(hook.result.current.tournament)).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 1 });

    // Abrufe laufen nacheinander: der zweite hängt, gilt nach der Frist als nicht erreichbar; danach kommt seine späte Antwort (1:1)
    act(() => { void hook.result.current.refresh(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(PUBLIC_FETCH_TIMEOUT_MS); });
    await act(async () => { late.resolve({ kind: 'full', version: '100', tournament: laeuft11() }); await vi.advanceTimersByTimeAsync(0); });

    expect(match7(hook.result.current.tournament)).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 1 });
    expect(hook.result.current.standings).toEqual(calculateStandingsPerGroup(beendet21()));
  });
});
