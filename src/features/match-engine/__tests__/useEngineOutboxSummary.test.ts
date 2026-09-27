/**
 * useEngineOutboxSummary (C3a-2a, Nachtrag W1): Zaehler + Ablehnungen fuer EIN Turnier,
 * `dismiss` gruppiert nach Spiel.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { LocalMatchStore, matchCopyKey } from '../../../core/match/client';

const mockContext: { current: unknown } = { current: null };
vi.mock('../useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockContext.current,
}));

import { useEngineOutboxSummary } from '../useEngineOutboxSummary';

const ctx = { matchId: 'm1', teamAId: 'teama', teamBId: 'teamb' };

async function makeContext(accountId: string) {
  const store = new LocalMatchStore();
  const listeners = new Set<() => void>();
  const status = { pendingByTournament: {}, pendingByMatch: {}, rejectedByMatch: {}, reviewByMatch: {}, pausedMatches: {}, authRequired: false, clientOutdated: false, storagePersisted: null, lastError: null };
  const dismissRejected = vi.fn(async (matchId: string, ids: string[]) => {
    await store.dismissRejected(matchCopyKey(accountId, matchId), ids);
    listeners.forEach((l) => l());
  });
  const sender = {
    getStatus: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dismissRejected,
  };
  return { store, sender, accountId, notify: () => listeners.forEach((l) => l()) };
}

describe('useEngineOutboxSummary (C3a-2a, W1)', () => {
  beforeEach(() => {
    mockContext.current = null;
  });

  it('ohne Provider: alle Zaehler 0, leere Liste', () => {
    const { result } = renderHook(() => useEngineOutboxSummary('tour-1'));
    expect(result.current.rejectedCount).toBe(0);
    expect(result.current.entries).toEqual([]);
  });

  it('liest Ablehnungen NUR fuer das uebergebene Turnier (auf mehrere Spiele/Turniere begrenzt)', async () => {
    const context = await makeContext('acc-outbox-1');
    await context.store.create('acc-outbox-1', 'm-a', ctx, 'tour-a');
    await context.store.create('acc-outbox-1', 'm-b', ctx, 'tour-b');
    await context.store.addPending('acc-outbox-1', 'm-a', { id: 'e1', type: 'GOAL', actor: 'helper', at: 1, section: 1, clockMs: 0, payload: {} });
    await context.store.rejectAllPending(matchCopyKey('acc-outbox-1', 'm-a'), 'MATCH_FULL', 1000);
    mockContext.current = context;

    const { result } = renderHook(() => useEngineOutboxSummary('tour-a'));

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].matchId).toBe('m-a');
    expect(result.current.rejectedCount).toBe(1);
  });

  it('dismiss ruft sender.dismissRejected je betroffenem Spiel auf und liest danach neu ein', async () => {
    const context = await makeContext('acc-outbox-2');
    await context.store.create('acc-outbox-2', 'm-c', ctx, 'tour-c');
    await context.store.addPending('acc-outbox-2', 'm-c', { id: 'e2', type: 'GOAL', actor: 'helper', at: 1, section: 1, clockMs: 0, payload: {} });
    await context.store.rejectAllPending(matchCopyKey('acc-outbox-2', 'm-c'), 'MATCH_FULL', 1000);
    mockContext.current = context;

    const { result } = renderHook(() => useEngineOutboxSummary('tour-c'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await result.current.dismiss(['e2']);

    expect(context.sender.dismissRejected).toHaveBeenCalledWith('m-c', ['e2']);
    await waitFor(() => expect(result.current.entries).toHaveLength(0));
  });

  it('Fixrunde 2 (Re-Review-Befund C4): ein IDB-Fehler in refresh() (store.forAccount) wird gefangen, keine unbehandelte Ablehnung, letzte Liste bleibt stehen', async () => {
    const context = await makeContext('acc-outbox-3');
    await context.store.create('acc-outbox-3', 'm-d', ctx, 'tour-d');
    await context.store.addPending('acc-outbox-3', 'm-d', { id: 'e3', type: 'GOAL', actor: 'helper', at: 1, section: 1, clockMs: 0, payload: {} });
    await context.store.rejectAllPending(matchCopyKey('acc-outbox-3', 'm-d'), 'MATCH_FULL', 1000);
    mockContext.current = context;
    const { result } = renderHook(() => useEngineOutboxSummary('tour-d'));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const originalForAccount = context.store.forAccount.bind(context.store);
    vi.spyOn(context.store, 'forAccount').mockRejectedValueOnce(new Error('IDB kaputt'));

    context.notify();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(unhandled).not.toHaveBeenCalled();
    // Letztes gutes Ergebnis bleibt stehen (kein Rueckfall auf leer).
    expect(result.current.entries).toHaveLength(1);

    process.off('unhandledRejection', unhandled);
    context.store.forAccount = originalForAccount;
  });
});
