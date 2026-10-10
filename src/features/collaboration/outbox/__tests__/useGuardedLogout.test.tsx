/**
 * Task C2b, Fixrunde 1 (Review I3): Abmelde-Warnung (D-C2) gebuendelt in einem Hook, damit
 * BEIDE Abmeldewege (UserProfileScreen, AuthSection-Dropdown) dieselbe Warnung zeigen. Der Hook
 * selbst ist reine Logik (kein Dialog-Markup) -- getestet ueber ein winziges Test-Bauteil.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGuardedLogout } from '../useGuardedLogout';
import type { WaitingEntriesSource } from '../countWaitingEntries';

// A-07c (@FU-006): der Hook liest die Konto-Queue ueber useRepositories().tournamentRepository.
const repoState = vi.hoisted(() => ({ repo: {} }));

vi.mock('../../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: repoState.repo }),
}));

/** Repo mit Konto-Queue (wie OfflineRepository.mutationQueue), `pending` wartende Eintraege. */
function queueRepo(getPendingCount: () => number): unknown {
  return { mutationQueue: { getPendingCount } };
}

function fakeStore(accountToCopies: Record<string, { pending: string[]; acked: string[] }[]>): WaitingEntriesSource {
  return {
    forAccount: vi.fn(async (accountId: string) =>
      (accountToCopies[accountId] ?? []).map((c) => ({
        formatVersion: 2 as const,
        accountId,
        matchId: 'm1',
        ctx: { matchId: 'm1', teamAId: 'a', teamBId: 'b' },
        confirmed: [],
        watermarkSeq: 0,
        pending: c.pending.map((id) => ({ id, type: 'GOAL' as const, actor: 'helper' as const, at: 0, section: 1, clockMs: 0, teamId: null, payload: {} })),
        acked: c.acked.map((id) => ({ id, type: 'GOAL' as const, actor: 'helper' as const, at: 0, section: 1, clockMs: 0, teamId: null, payload: {} })),
        rejected: [],
        review: [],
        updatedAt: 0,
      })),
    ),
  };
}

describe('useGuardedLogout (D-C2, Review I3)', () => {
  beforeEach(() => {
    repoState.repo = {};
  });

  it('Gast meldet direkt ab, ohne zu zaehlen', async () => {
    const logout = vi.fn();
    const store = fakeStore({});
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: true, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(store.forAccount).not.toHaveBeenCalled();
    expect(result.current.waitingCount).toBeNull();
  });

  it('0 wartende Eintraege melden direkt ab', async () => {
    const logout = vi.fn();
    const store = fakeStore({ 'acc-1': [{ pending: [], acked: [] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('> 0 wartende Eintraege setzen waitingCount, ohne abzumelden', async () => {
    const logout = vi.fn();
    const store = fakeStore({ 'acc-1': [{ pending: ['e1', 'e2'], acked: ['e3'] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(3));
    expect(logout).not.toHaveBeenCalled();
  });

  it('cancel schliesst ohne abzumelden, confirm meldet ab', async () => {
    const logout = vi.fn();
    const store = fakeStore({ 'acc-1': [{ pending: ['e1'], acked: [] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(1));

    act(() => result.current.cancel());
    expect(result.current.waitingCount).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(1));
    act(() => result.current.confirm());
    expect(logout).toHaveBeenCalledTimes(1);
    expect(result.current.waitingCount).toBeNull();
  });

  it('Zaehlfehler (asynchron oder synchron) meldet trotzdem ab', async () => {
    const logout = vi.fn();
    const rejectingStore: WaitingEntriesSource = { forAccount: vi.fn(async () => Promise.reject(new Error('DB weg'))) };
    const { result: r1 } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => rejectingStore }),
    );
    act(() => r1.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));

    logout.mockClear();
    const throwingFactory = (): never => {
      throw new Error('IndexedDB nicht verfuegbar');
    };
    const { result: r2 } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: throwingFactory }),
    );
    act(() => r2.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('A-07c @FU-006: Weg A (2) + Weg B (1) ergeben 3 wartende Eintraege', async () => {
    const logout = vi.fn();
    repoState.repo = queueRepo(() => 1);
    const store = fakeStore({ 'acc-1': [{ pending: ['e1', 'e2'], acked: [] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(3));
    expect(logout).not.toHaveBeenCalled();
  });

  it('A-07c: nur Weg B (Queue 1, Weg A 0) zaehlt und warnt', async () => {
    const logout = vi.fn();
    repoState.repo = queueRepo(() => 1);
    const store = fakeStore({});
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(1));
    expect(logout).not.toHaveBeenCalled();
  });

  it('A-07c Gegenbeispiel: 0 + 0 meldet direkt ab, ohne Dialog', async () => {
    const logout = vi.fn();
    repoState.repo = queueRepo(() => 0);
    const store = fakeStore({ 'acc-1': [{ pending: [], acked: [] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(result.current.waitingCount).toBeNull();
  });

  it('A-07c Gegenbeispiel: Queue-Lesen wirft -> nur Weg A zaehlt, Abmelden nicht blockiert', async () => {
    const logout = vi.fn();
    repoState.repo = queueRepo(() => {
      throw new Error('Queue weg');
    });
    const store = fakeStore({ 'acc-1': [{ pending: ['e1'], acked: [] }] });
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.waitingCount).toBe(1));
    expect(logout).not.toHaveBeenCalled();
  });

  it('A-07c Gegenbeispiel: Queue-Lesen wirft, Weg A 0 -> meldet trotzdem ab', async () => {
    const logout = vi.fn();
    repoState.repo = queueRepo(() => {
      throw new Error('Queue weg');
    });
    const store = fakeStore({});
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: false, accountId: 'acc-1', logout, createMatchStore: () => store }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(result.current.waitingCount).toBeNull();
  });

  it('A-07c Gegenbeispiel: Gast zaehlt die Queue nicht und meldet direkt ab', async () => {
    const logout = vi.fn();
    const getPendingCount = vi.fn(() => 5);
    repoState.repo = queueRepo(getPendingCount);
    const { result } = renderHook(() =>
      useGuardedLogout({ isGuest: true, accountId: 'acc-1', logout, createMatchStore: () => fakeStore({}) }),
    );
    act(() => result.current.handleLogout());
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(getPendingCount).not.toHaveBeenCalled();
  });
});
