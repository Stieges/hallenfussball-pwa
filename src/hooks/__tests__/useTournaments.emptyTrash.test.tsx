/**
 * @LZ-094 „Papierkorb leeren“ löscht nach einer Rückfrage alle Turniere im Papierkorb; lässt sich eines nicht löschen,
 * nennt die App es mit Namen und löscht die übrigen trotzdem. Szenario: docs/anforderungen/2026-10-01_turnier-lebenszyklus.md.
 * Harness wie useTournaments.abschlussSperre.test.tsx. Befund C-PAPIERKORB-LEEREN-NUR-LETZTES / -BRICHT-AB.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({
  repoList: [] as unknown[],
  remove: vi.fn(async (_id: string) => undefined),
}));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: false, isGuest: true, isAnonymous: false }),
}));
vi.mock('../useRepository', () => {
  const repository = { listForCurrentUser: async () => hoisted.repoList, save: vi.fn(), delete: (id: string) => hoisted.remove(id) };
  return { useRepository: () => repository };
});

import { useTournaments } from '../useTournaments';

const turnier = (id: string, title: string, deletedAt?: string): Tournament =>
  ({ id, title, status: 'published', deletedAt, matches: [], teams: [] } as unknown as Tournament);

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.remove.mockImplementation(async () => undefined);
  hoisted.repoList = [
    turnier('wc', 'Wintercup', '2026-11-01T10:00:00Z'),
    turnier('alt', 'Testturnier alt', '2026-11-02T10:00:00Z'),
    turnier('f2', 'F2-Junioren', undefined),
  ];
});

describe('@LZ-094 Papierkorb leeren', () => {
  it('löscht „Wintercup“ und „Testturnier alt“, nie ein Turnier außerhalb des Papierkorbs', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(3));
    let ergebnis: Awaited<ReturnType<typeof result.current.emptyTrash>> | undefined;
    await act(async () => { ergebnis = await result.current.emptyTrash(); });
    expect(hoisted.remove.mock.calls.map((c) => c[0]).sort()).toEqual(['alt', 'wc']);
    expect(ergebnis).toEqual({ deleted: 2, failed: [] });
  });

  it('lässt sich ein Turnier nicht löschen, nennt das Ergebnis es mit Namen, und das andere wird trotzdem gelöscht', async () => {
    hoisted.remove.mockImplementation(async (id: string) => { if (id === 'wc') { throw new Error('Server lehnt ab'); } });
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(3));
    let ergebnis: Awaited<ReturnType<typeof result.current.emptyTrash>> | undefined;
    await act(async () => { ergebnis = await result.current.emptyTrash(); });
    expect(hoisted.remove).toHaveBeenCalledTimes(2);
    expect(ergebnis).toEqual({ deleted: 1, failed: [{ id: 'wc', title: 'Wintercup' }] });
  });

  it('Gegenbeispiel: scheitert das erste Turnier der Liste, bricht das Leeren nicht ab', async () => {
    hoisted.remove.mockImplementation(async (id: string) => { if (id === 'alt') { throw new Error('x'); } });
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(3));
    await act(async () => { await result.current.emptyTrash(); });
    expect(hoisted.remove.mock.calls.map((c) => c[0]).sort()).toEqual(['alt', 'wc']);
  });
});
