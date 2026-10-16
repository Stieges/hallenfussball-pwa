/**
 * useUserTournaments.guestHide.test.ts — C3b-2c (G7): Ausblenden in der Kontoliste.
 *
 * G7 (task-C3b-plan.md): Nach der Anmeldung sind Turniere mit Engine-Einträgen
 * im Gastkonto in der Turnierliste des Kontos ausgeblendet (Anzeige-Hook,
 * NICHT listForCurrentUser). Ohne Einträge bleiben sie sichtbar.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';
import { LocalMatchStore } from '../../../../core/match/client/LocalMatchStore';
import { ctx, ev } from '../../../../core/match/client/__tests__/fixtures';

const hoisted = vi.hoisted(() => ({
  authState: {
    user: { id: 'u1' },
    isAuthenticated: true,
    isGuest: false,
    isAnonymous: false,
    isLoading: false,
  },
  repoList: [] as unknown[],
}));

vi.mock('../useAuth', () => ({
  useAuth: () => hoisted.authState,
}));

vi.mock('../../../../hooks/useRepository', () => ({
  useRepository: () => ({
    listForCurrentUser: vi.fn(async () => hoisted.repoList),
    save: vi.fn(async () => undefined),
  }),
}));

import { useUserTournaments } from '../useUserTournaments';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    status: 'draft',
    teams: [],
    numberOfFields: 1,
    date: '2026-01-01',
    location: 'Halle',
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('useUserTournaments — G7-Ausblenden (C3b-2c)', () => {
  beforeEach(() => {
    hoisted.authState = {
      user: { id: 'u1' },
      isAuthenticated: true,
      isGuest: false,
      isAnonymous: false,
      isLoading: false,
    };
    hoisted.repoList = [];
  });

  it('Konto: Turnier mit Gast-Einträgen ist in der Liste ausgeblendet', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'ut-acc-m1', ctx);
    await store.addConfirmedLocal('guest', 'ut-acc-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.repoList = [tournament('t-ut-guard', 'ut-acc-m1'), tournament('t-ut-free', 'ut-acc-f')];

    const { result } = renderHook(() => useUserTournaments());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tournaments.map((u) => u.tournament.id)).toEqual(['t-ut-free']);
    expect(result.current.counts.total).toBe(1);
  });

  it('Konto: Turnier ohne Einträge bleibt sichtbar', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'ut-free-m1', ctx);
    hoisted.repoList = [tournament('t-ut-free2', 'ut-free-m1')];

    const { result } = renderHook(() => useUserTournaments());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tournaments.map((u) => u.tournament.id)).toEqual(['t-ut-free2']);
    expect(result.current.counts.total).toBe(1);
  });
});