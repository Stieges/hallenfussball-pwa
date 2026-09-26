/**
 * Task C2b, Aufgabe 3: Status-Hook fuer die Ausgangs-Anzeige.
 * `useOutboxStatus` bildet die Status-API des Senders per
 * `useSyncExternalStore` ab (C2a: OutboxSender.getStatus/subscribe).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { OutboxStatus } from '../../../../core/match/client/outboxTypes';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';
import {
  pendingForTournament,
  rejectedTotal,
  reviewTotal,
  useOutboxStatus,
} from '../useOutboxStatus';

function makeStatus(overrides: Partial<OutboxStatus> = {}): OutboxStatus {
  return { ...emptyOutboxStatus(), ...overrides };
}

interface FakeSender {
  getStatus(): OutboxStatus;
  subscribe(listener: (status: OutboxStatus) => void): () => void;
  emit(status: OutboxStatus): void;
}

function makeSender(initial: OutboxStatus): FakeSender {
  const listeners = new Set<(status: OutboxStatus) => void>();
  let current = initial;
  return {
    getStatus: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (status) => {
      current = status;
      for (const listener of listeners) {
        listener(status);
      }
    },
  };
}

describe('useOutboxStatus', () => {
  it('ohne Sender liefert der leere Status', () => {
    const { result } = renderHook(() => useOutboxStatus(null));
    expect(result.current).toEqual(emptyOutboxStatus());
  });

  it('uebernimmt den Status des Senders und aktualisiert bei Benachrichtigung', () => {
    const sender = makeSender(makeStatus({ authRequired: true }));
    const { result } = renderHook(() => useOutboxStatus(sender));
    expect(result.current.authRequired).toBe(true);

    act(() => {
      sender.emit(makeStatus({ clientOutdated: true }));
    });
    expect(result.current.clientOutdated).toBe(true);
    expect(result.current.authRequired).toBe(false);
  });

  it('meldet sich beim Unmount ab', () => {
    const unsubscribe = vi.fn();
    const stable = emptyOutboxStatus();
    const sender: FakeSender = {
      getStatus: () => stable,
      subscribe: () => unsubscribe,
      emit: () => undefined,
    };
    const { unmount } = renderHook(() => useOutboxStatus(sender));
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('abgeleitete Helfer', () => {
  const status = makeStatus({
    pendingByTournament: { t1: 3, t2: 1 },
    rejectedByMatch: { m1: 2, m2: 5 },
    reviewByMatch: { m1: 1, m2: 4, m3: 2 },
  });

  it('pendingForTournament liest die Zahl je Turnier', () => {
    expect(pendingForTournament(status, 't1')).toBe(3);
    expect(pendingForTournament(status, 't2')).toBe(1);
    expect(pendingForTournament(status, 'fehlt')).toBe(0);
  });

  it('rejectedTotal summiert, optional auf die genannten Spiele begrenzt', () => {
    expect(rejectedTotal(status)).toBe(7);
    expect(rejectedTotal(status, ['m1'])).toBe(2);
    expect(rejectedTotal(status, ['m1', 'm2'])).toBe(7);
    expect(rejectedTotal(status, [])).toBe(0);
    expect(rejectedTotal(status, ['fehlt'])).toBe(0);
  });

  it('reviewTotal summiert, optional auf die genannten Spiele begrenzt', () => {
    expect(reviewTotal(status)).toBe(7);
    expect(reviewTotal(status, ['m3'])).toBe(2);
    expect(reviewTotal(status, ['fehlt'])).toBe(0);
  });
});
