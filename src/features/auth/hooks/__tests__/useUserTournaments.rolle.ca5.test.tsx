/**
 * CA-5 (Plan CA-5a, Befund C-LISTE-NUR-EIGENTUEMER): Die Turnierliste im Profil nimmt die Rolle aus dem Listenobjekt
 * (`myRole`) statt jede Zeile still als Eigentümer zu führen. @HE-085: Maria ist im Nikolaus-Turnier Co-Admin.
 * Gegenbeispiel: ein Turnier ohne Rolle (lokal angelegt) bleibt wie bisher „owner“.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../types/tournament';

const hoisted = vi.hoisted(() => ({ repoList: [] as unknown[] }));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ user: { id: 'maria' }, isAuthenticated: true, isGuest: false, isAnonymous: false, isLoading: false }),
}));
vi.mock('../../../../hooks/useRepository', () => {
  const repo = { listForCurrentUser: vi.fn(async () => hoisted.repoList), save: vi.fn(async () => undefined) };
  return { useRepository: () => repo };
});
vi.mock('../../../../core/match/client/guestEngineEntries', () => ({
  filterWithoutGuestEngineEntries: (list: unknown[]) => Promise.resolve(list),
}));

import { useUserTournaments } from '../useUserTournaments';

function tournament(id: string, myRole?: Tournament['myRole']): Tournament {
  return {
    id, title: id, status: 'published', teams: [], matches: [], numberOfFields: 1, date: '2026-12-06', location: 'Halle',
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
    ...(myRole === undefined ? {} : { myRole }),
  } as unknown as Tournament;
}

describe('CA-5 useUserTournaments: Rolle aus dem Listenobjekt', () => {
  it('@HE-085 Co-Admin-Turnier trägt die Rolle co-admin, das lokal angelegte bleibt owner', async () => {
    hoisted.repoList = [tournament('nikolaus', 'co-admin'), tournament('eigen')];
    const { result } = renderHook(() => useUserTournaments('name'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tournaments.map((u) => [u.tournament.id, u.membership.role])).toEqual([['eigen', 'owner'], ['nikolaus', 'co-admin']]);
  });
});
