/**
 * useTournaments.guestHide.test.ts — C3b-2c (G7): Ausblenden in der Anzeige.
 *
 * G7 (task-C3b-plan.md): Nach der Anmeldung werden Turniere mit Engine-Einträgen
 * im Gastkonto im Konto ausgeblendet (Anzeige-Hooks, NICHT listForCurrentUser),
 * zählen aber weiter zum Turnier-Limit. Nach dem Abmelden (Gastmodus) sind sie
 * mit allen Ergebnissen wieder sichtbar.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { LocalMatchStore } from '../../core/match/client/LocalMatchStore';
import { ctx, ev } from '../../core/match/client/__tests__/fixtures';

const hoisted = vi.hoisted(() => ({
  authState: {
    user: { id: 'u1' },
    isAuthenticated: true,
    isGuest: false,
    isAnonymous: false,
  },
  repoList: [] as unknown[],
}));

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => hoisted.authState,
}));

vi.mock('../useRepository', () => ({
  useRepository: () => ({
    listForCurrentUser: vi.fn(async () => hoisted.repoList),
    save: vi.fn(async () => undefined),
  }),
}));

import { useTournaments } from '../useTournaments';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('useTournaments — G7-Ausblenden (C3b-2c)', () => {
  beforeEach(() => {
    hoisted.authState = {
      user: { id: 'u1' },
      isAuthenticated: true,
      isGuest: false,
      isAnonymous: false,
    };
    hoisted.repoList = [];
  });

  it('Konto: Turnier mit Gast-Einträgen ist ausgeblendet, zählt aber im allActiveCount weiter', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'uh-acc-m1', ctx);
    await store.addConfirmedLocal('guest', 'uh-acc-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.repoList = [tournament('t-uh-guard', 'uh-acc-m1'), tournament('t-uh-free', 'uh-acc-f')];

    const { result } = renderHook(() => useTournaments());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tournaments.map((t) => t.id)).toEqual(['t-uh-free']);
    expect(result.current.allActiveCount).toBe(2);
  });

  it('nach Abmelden (Gastmodus): Turnier ist mit allen Ergebnissen wieder sichtbar', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'uh-guest-m1', ctx);
    await store.addConfirmedLocal('guest', 'uh-guest-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.authState = {
      user: { id: 'u-guest' },
      isAuthenticated: true,
      isGuest: true,
      isAnonymous: false,
    };
    hoisted.repoList = [tournament('t-uh-back', 'uh-guest-m1')];

    const { result } = renderHook(() => useTournaments());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tournaments.map((t) => t.id)).toEqual(['t-uh-back']);
    const copies = await store.forAccount('guest');
    const copy = copies.find((c) => c.matchId === 'uh-guest-m1');
    expect(copy?.confirmed).toHaveLength(1);
  });

  it('Konto: Turnier ohne Einträge bleibt sichtbar', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'uh-free-m1', ctx);
    hoisted.repoList = [tournament('t-uh-free2', 'uh-free-m1')];

    const { result } = renderHook(() => useTournaments());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tournaments.map((t) => t.id)).toEqual(['t-uh-free2']);
    expect(result.current.allActiveCount).toBe(1);
  });
});