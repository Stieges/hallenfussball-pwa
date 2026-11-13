/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS (gleiche Ursache, Papierkorb/Wiederherstellen der Startseite) -- @W5-040, @W5-041:
 * Die Startseiten-Liste kennt nur Kopfdaten. „In den Papierkorb“ und „Wiederherstellen“ ändern nur die Löschmarke
 * (`setTrashed`) und speichern nie den Listen-Eintrag als ganzes Turnier; die Umstellung alter Orts-Angaben überspringt Listen-Einträge.
 *
 * Mutation: softDeleteTournament/restoreTournament wieder per saveTournament(...) -> rot.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({
  repoList: [] as unknown[],
  save: vi.fn(async () => undefined),
  setTrashed: vi.fn(async () => undefined),
}));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: false, isGuest: true, isAnonymous: false }),
}));
vi.mock('../useRepository', () => {
  const repository = { listForCurrentUser: async () => hoisted.repoList, save: hoisted.save, setTrashed: hoisted.setTrashed };
  return { useRepository: () => repository };
});

import { useTournaments } from '../useTournaments';

const eintrag = (id: string, extra: Partial<Tournament> = {}): Tournament =>
  ({ id, title: `Turnier ${id}`, status: 'published', matches: [], teams: [], listEntryOnly: true, ...extra } as unknown as Tournament);

beforeEach(() => { vi.clearAllMocks(); hoisted.repoList = [eintrag('a'), eintrag('b', { deletedAt: '2026-11-01T08:00:00.000Z' })]; });

describe('@W5-040 Papierkorb und Wiederherstellen der Startseite', () => {
  it('In den Papierkorb: nur die Löschmarke, kein Speichern des Listen-Eintrags', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.softDeleteTournament('a'); });
    expect(hoisted.setTrashed).toHaveBeenCalledWith('a', expect.any(String), undefined);
    expect(hoisted.save).not.toHaveBeenCalled();
  });

  it('Wiederherstellen: Marke null, kein Speichern des Listen-Eintrags', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.restoreTournament('b'); });
    expect(hoisted.setTrashed).toHaveBeenCalledWith('b', null, undefined);
    expect(hoisted.save).not.toHaveBeenCalled();
  });

  it('Wiederherstellen als Entwurf gibt den Zustand als Angabe mit, ohne das Turnier zu speichern', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.restoreTournament('b', { restoreAs: 'draft' }); });
    expect(hoisted.setTrashed).toHaveBeenCalledWith('b', null, { status: 'draft' });
    expect(hoisted.save).not.toHaveBeenCalled();
  });

  it('@W5-041 alte Orts-Angaben als Text: Listen-Einträge werden beim Laden nie gespeichert, ein volles Turnier schon (Gegenbeispiel)', async () => {
    hoisted.repoList = [eintrag('a', { location: 'Halle' as never }), { ...eintrag('v', { location: 'Halle' as never }), listEntryOnly: undefined }];
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    const gespeichert = hoisted.save.mock.calls.map((aufruf) => (aufruf as unknown as [Tournament])[0].id);
    expect(gespeichert).toEqual(['v']);
  });
});
