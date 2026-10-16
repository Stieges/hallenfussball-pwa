/**
 * useTournamentLimit.guestHide.test.ts — C3b-2c (G7): Limit zählt weiter.
 *
 * G7 (task-C3b-plan.md): Ein im Konto ausgeblendetes Turnier mit Engine-Einträgen
 * zählt weiter zum Turnier-Limit — ausgeblendet wird nur die Anzeige, nicht der
 * Verbrauch (useTournamentLimit nutzt den ungefilterten Zähler aus useTournaments).
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
    isAnonymous: true,
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

import { useTournamentLimit } from '../useTournamentLimit';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('useTournamentLimit — G7: ausgeblendet zählt weiter (C3b-2c)', () => {
  beforeEach(() => {
    hoisted.authState = {
      user: { id: 'u1' },
      isAuthenticated: true,
      isGuest: false,
      isAnonymous: true,
      isLoading: false,
    };
    hoisted.repoList = [];
  });

  it('ein ausgeblendetes Turnier mit Gast-Einträgen zählt weiter zum Limit', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'tl-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'tl-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.repoList = [tournament('t-tl-guard', 'tl-guard-m1')];

    const { result } = renderHook(() => useTournamentLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Anzeige ist leer (Turnier ausgeblendet), der Limit-Verbrauch bleibt bei 1.
    expect(result.current.used).toBe(1);
  });

  it('Turniere ohne Einträge zählen wie bisher', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'tl-free-m1', ctx);
    hoisted.repoList = [tournament('t-tl-free', 'tl-free-m1')];

    const { result } = renderHook(() => useTournamentLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.used).toBe(1);
  });
});