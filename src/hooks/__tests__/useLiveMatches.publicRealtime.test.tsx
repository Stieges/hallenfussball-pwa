/** useLiveMatches — Opt-in für den Anon-Live-Repo (L2/L4) */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const subscribe = vi.fn();
const unsubscribe = vi.fn();
const getAll = vi.fn().mockResolvedValue(new Map());
const localGetAll = vi.fn().mockResolvedValue(new Map());

const mockContext = {
  tournamentRepository: {},
  liveMatchRepository: { getAll: localGetAll },
  isRealtimeEnabled: false,
  supabaseLiveMatchRepo: null as unknown,
  publicLiveMatchRepo: { getAll, subscribe, unsubscribe, unsubscribeAll: vi.fn() },
};
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => mockContext }));

import { useLiveMatches } from '../useLiveMatches';

describe('useLiveMatches — allowPublicRealtime', () => {
  beforeEach(() => { vi.clearAllMocks(); mockContext.isRealtimeEnabled = false; mockContext.supabaseLiveMatchRepo = null; });

  it('L2/L4: abonniert den Anon-Repo, wenn allowPublicRealtime gesetzt ist', async () => {
    renderHook(() => useLiveMatches('t1', { allowPublicRealtime: true }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith('t1', expect.anything()));
    expect(getAll).toHaveBeenCalledWith('t1');
    expect(localGetAll).not.toHaveBeenCalled();
  });

  it('Regression: ohne die Option bleibt es beim localStorage-Polling', async () => {
    renderHook(() => useLiveMatches('t1'));
    await new Promise((r) => setTimeout(r, 50));
    expect(subscribe).not.toHaveBeenCalled();
    expect(getAll).not.toHaveBeenCalled();
  });

  it('Regression: der authentifizierte Repo hat Vorrang vor dem Anon-Repo', async () => {
    const authSubscribe = vi.fn();
    mockContext.isRealtimeEnabled = true;
    mockContext.supabaseLiveMatchRepo = {
      getAll: vi.fn().mockResolvedValue(new Map()), subscribe: authSubscribe, unsubscribe: vi.fn(), unsubscribeAll: vi.fn(),
    };
    renderHook(() => useLiveMatches('t1', { allowPublicRealtime: true }));
    await waitFor(() => expect(authSubscribe).toHaveBeenCalled());
    expect(subscribe).not.toHaveBeenCalled();
  });
});
