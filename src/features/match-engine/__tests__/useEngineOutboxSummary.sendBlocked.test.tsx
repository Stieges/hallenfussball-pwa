/**
 * useEngineOutboxSummary.sendBlocked (@SL-168): „Netz da, aber nichts kommt durch“ (Hallen-WLAN ohne Internet). Mit dem ECHTEN
 * OutboxSender und gescheiterter Übertragung: `sendBlocked` ist nur dann wahr, wenn ein Spiel dieses Turniers nach einem
 * vorläufigen Fehler (Netz/Zeitlimit) in der Wartepause steht – nicht beim normalen Senden, nicht bei dauerhaften Fehlern,
 * nicht bei „Spiel noch nicht bereit“, nicht für ein anderes Turnier.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ctx, ev } from '../../../core/match/client/__tests__/fixtures';
import { acceptAll, makeHarness, networkError, rpcError, type Harness } from '../../../core/match/client/__tests__/outboxHarness';

const mockContext: { current: unknown } = { current: null };
vi.mock('../useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockContext.current,
}));

import { useEngineOutboxSummary } from '../useEngineOutboxSummary';

const KONTO = 'acc-blocked';

async function aufbau(h: Harness, spiele: Array<[string, string]>): Promise<void> {
  for (const [matchId, tournamentId] of spiele) {
    await h.store.create(KONTO, matchId, ctx, tournamentId);
    await h.store.addPending(KONTO, matchId, ev({ id: `e-${matchId}`, type: 'GOAL', at: 1 }));
  }
  mockContext.current = { sender: h.sender, store: h.store, accountId: KONTO };
}

describe('useEngineOutboxSummary: sendBlocked (@SL-168)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    mockContext.current = null;
  });

  it('Netzfehler (vorläufig): der Ausgang steht in der Wartepause → sendBlocked, der Zähler zeigt den wartenden Eintrag', async () => {
    const h = makeHarness();
    h.api.mockRejectedValue(networkError());
    await aufbau(h, [['m1', 'tour-1']]);
    const { result } = renderHook(() => useEngineOutboxSummary('tour-1'));
    await h.sender.start(KONTO);
    await waitFor(() => expect(result.current.sendBlocked).toBe(true));
    expect(result.current.pendingCount).toBe(1);
    h.sender.stop();
  });

  it('Gegenbeispiel: Senden klappt – sendBlocked ist nie wahr, auch nicht kurz', async () => {
    const h = makeHarness();
    await aufbau(h, [['m1', 'tour-1']]);
    const gesehen: boolean[] = [];
    const { result } = renderHook(() => {
      const zusammenfassung = useEngineOutboxSummary('tour-1');
      gesehen.push(zusammenfassung.sendBlocked);
      return zusammenfassung;
    });
    await h.sender.start(KONTO);
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(gesehen).not.toContain(true);
    h.sender.stop();
  });

  it('klappt der nächste Versuch (Verbinden), ist sendBlocked wieder aus', async () => {
    const h = makeHarness();
    h.api.mockRejectedValueOnce(networkError());
    await aufbau(h, [['m1', 'tour-1']]);
    const { result } = renderHook(() => useEngineOutboxSummary('tour-1'));
    await h.sender.start(KONTO);
    await waitFor(() => expect(result.current.sendBlocked).toBe(true));
    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.kick();
    await waitFor(() => expect(result.current.sendBlocked).toBe(false));
    expect(result.current.pendingCount).toBe(0);
    h.sender.stop();
  });

  it('Gegenbeispiele: dauerhafter Fehler und „Spiel noch nicht bereit“ sind kein „Netz ohne Durchkommen“', async () => {
    const dauerhaft = makeHarness();
    dauerhaft.api.mockRejectedValue(rpcError('XX000', 'interner Serverfehler'));
    await aufbau(dauerhaft, [['m1', 'tour-1']]);
    const erster = renderHook(() => useEngineOutboxSummary('tour-1'));
    await dauerhaft.sender.start(KONTO);
    await waitFor(() => expect(Object.keys(dauerhaft.sender.getStatus().pausedMatches)).toEqual(['m1']));
    await new Promise((fertig) => { setTimeout(fertig, 50); });
    expect(erster.result.current.sendBlocked).toBe(false);
    dauerhaft.sender.stop();
    erster.unmount();

    vi.stubGlobal('indexedDB', new IDBFactory());
    const nichtBereit = makeHarness();
    nichtBereit.api.mockRejectedValue(rpcError('22023', 'Teams offen'));
    await aufbau(nichtBereit, [['m2', 'tour-2']]);
    const zweiter = renderHook(() => useEngineOutboxSummary('tour-2'));
    await nichtBereit.sender.start(KONTO);
    await waitFor(() => expect(nichtBereit.sender.getStatus().pausedMatches).toEqual({ m2: 'notReady' }));
    await new Promise((fertig) => { setTimeout(fertig, 50); });
    expect(zweiter.result.current.sendBlocked).toBe(false);
    nichtBereit.sender.stop();
  });

  it('Gegenbeispiel: ein anderes Turnier steht in der Wartepause – dieses Turnier zeigt keine Pille', async () => {
    const h = makeHarness();
    h.api.mockRejectedValue(networkError());
    await aufbau(h, [['m1', 'tour-1']]);
    const { result } = renderHook(() => useEngineOutboxSummary('tour-anderes'));
    await h.sender.start(KONTO);
    await waitFor(() => expect(h.sender.getStatus().pausedMatches).toEqual({ m1: 'backoff' }));
    await new Promise((fertig) => { setTimeout(fertig, 50); });
    expect(result.current.sendBlocked).toBe(false);
    h.sender.stop();
  });
});
