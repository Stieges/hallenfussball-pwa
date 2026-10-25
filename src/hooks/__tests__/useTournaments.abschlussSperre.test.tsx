/**
 * R3-3 Startseite (Liste der Turniere) nach dem Abschluss: „Dashboard Löschen/Papierkorb“ (`deleted_at` lehnt der Server mit
 * 55000 ab, @LZ-036/@LZ-037 Z. 8 ist bewusst später) und die Anbindung der Liste an `useCan` (Verzeichnis der abgeschlossenen
 * Turniere, damit Wizard und Karten den Abschluss kennen). Harness wie useTournaments.guestHide.test.ts.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({
  repoList: [] as unknown[],
  save: vi.fn(async () => undefined),
}));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: false, isGuest: true, isAnonymous: false }),
}));
vi.mock('../useRepository', () => {
  const repository = { listForCurrentUser: async () => hoisted.repoList, save: hoisted.save }; // stabil: sonst lädt der Hook endlos neu
  return { useRepository: () => repository };
});

import { useTournaments } from '../useTournaments';
import { isTournamentClosedById, resetClosedTournaments } from '../../core/services/closedTournaments';

const t = (id: string, lifecycleStatus: Tournament['lifecycleStatus']): Tournament =>
  ({ id, title: `Turnier ${id}`, status: 'published', lifecycleStatus, matches: [], teams: [] } as unknown as Tournament);

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); hoisted.repoList = [t('zu', 'finished'), t('auf', 'fixed')]; });
afterEach(() => resetClosedTournaments());

describe('@LZ-036 Startseite nach dem Abschluss', () => {
  it('die Liste trägt den Abschluss jedes Turniers ein (offene bleiben offen)', async () => {
    renderHook(() => useTournaments());
    await waitFor(() => expect(isTournamentClosedById('zu')).toBe(true));
    expect(isTournamentClosedById('auf')).toBe(false);
  });

  it('abgeschlossen: „In den Papierkorb“ wird nicht gespeichert, der Aufrufer bekommt einen Fehler (sichtbare Meldung in App.tsx)', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await expect(result.current.softDeleteTournament('zu')).rejects.toThrow('TOURNAMENT_CLOSED');
    expect(hoisted.save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: offen – „In den Papierkorb“ wird gespeichert', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.softDeleteTournament('auf'); });
    expect(hoisted.save).toHaveBeenCalledTimes(1);
  });
});
