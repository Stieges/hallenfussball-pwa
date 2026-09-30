/**
 * useInitialSync.guestGuard.test.ts — C3b-2c (G7): Wache am Initial-Sync-Weg.
 *
 * G7 (task-C3b-plan.md): Der erste Sync nach dem Login (`useInitialSync`,
 * `App.tsx:834`) lädt lokale Turniere mit `ownerId` fehlt/'guest' hoch — ein
 * direkter `supabaseRepo.save`-Weg. Turniere mit Engine-Einträgen im Gastkonto
 * dürfen hier NICHT hochgeladen werden (Upload + Owner-Update bleiben aus).
 * Turniere ohne Einträge laufen wie bisher.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { LocalMatchStore } from '../../core/match/client/LocalMatchStore';
import { ctx, ev } from '../../core/match/client/__tests__/fixtures';

const hoisted = vi.hoisted(() => ({
  localList: [] as Tournament[],
  localSaved: [] as string[],
  cloudSaved: [] as Tournament[],
  cloudList: [] as Tournament[],
}));

vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true, isGuest: false }),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.localList;
    }
    async save(tournament: Tournament): Promise<void> {
      hoisted.localSaved.push(tournament.id);
    }
  },
}));

vi.mock('../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.cloudList;
    }
    async get(id: string): Promise<Tournament | null> {
      return hoisted.cloudList.find((t) => t.id === id) ?? null;
    }
    async save(tournament: Tournament): Promise<void> {
      hoisted.cloudSaved.push(tournament);
    }
  },
}));

import { useInitialSync } from '../useInitialSync';
import {
  subscribeToGuestTournamentNotices,
  type GuestTournamentNotice,
} from '../../core/services/guestTournamentNotices';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('useInitialSync — G7-Wache (C3b-2c)', () => {
  beforeEach(() => {
    hoisted.localList = [];
    hoisted.localSaved = [];
    hoisted.cloudSaved = [];
    hoisted.cloudList = [];
  });

  it('lädt ein Turnier mit Gast-Einträgen nicht hoch (kein save, kein Owner-Update)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'is-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'is-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.localList = [tournament('t-is-guard', 'is-guard-m1')];
    const received: GuestTournamentNotice[] = [];
    const unsubscribe = subscribeToGuestTournamentNotices((notice) => received.push(notice));

    renderHook(() => useInitialSync());
    await settle();

    expect(hoisted.cloudSaved).toEqual([]);
    expect(hoisted.localSaved).toEqual([]);
    expect(received).toEqual([
      { tournamentId: 't-is-guard', title: 'Turnier t-is-guard' },
    ]);
    unsubscribe();
  });

  it('lädt ein Turnier ohne Einträge wie bisher hoch (inkl. Owner-Update)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'is-free-m1', ctx);
    hoisted.localList = [tournament('t-is-free', 'is-free-m1')];

    renderHook(() => useInitialSync());
    await settle();

    expect(hoisted.cloudSaved.map((t) => t.id)).toEqual(['t-is-free']);
    expect(hoisted.localSaved).toEqual(['t-is-free']);
  });
});