/**
 * C-HALBZEIT-NICHT-LAUFEND: Die Startseite zählt ein Turnier mit Spiel in der Halbzeit (paused) als „live“.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';

const hoisted = vi.hoisted(() => ({ repoList: [] as unknown[] }));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true, isGuest: false, isAnonymous: false, isLoading: false }),
}));
vi.mock('../../../../hooks/useRepository', () => {
  const repo = { listForCurrentUser: vi.fn(async () => hoisted.repoList), save: vi.fn(async () => undefined) };
  return { useRepository: () => repo };
});

import { useUserTournaments } from '../useUserTournaments';

const tournament = (id: string, statuses: string[]): Tournament =>
  ({
    id, title: id, status: 'published', teams: [], numberOfFields: 1, date: '2026-01-01', location: 'Halle',
    matches: statuses.map((s, i) => ({ id: `${id}-m${i}`, matchStatus: s })),
  }) as unknown as Tournament;

const statusOf = async (t: Tournament) => {
  hoisted.repoList = [t];
  const { result } = renderHook(() => useUserTournaments());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result.current.tournaments[0].tournament.status;
};

describe('useUserTournaments – Halbzeit zählt als live (C-HALBZEIT-NICHT-LAUFEND)', () => {
  beforeEach(() => { hoisted.repoList = []; });

  it('ein Turnier mit Spiel in der Halbzeit (paused) ist „live“', async () => {
    expect(await statusOf(tournament('t-hz', ['finished', 'paused', 'scheduled']))).toBe('live');
  });

  it('Gegenbeispiel: nur beendete und geplante Spiele ergeben „upcoming“, nicht „live“', async () => {
    expect(await statusOf(tournament('t-nl', ['finished', 'scheduled']))).toBe('upcoming');
  });
});
