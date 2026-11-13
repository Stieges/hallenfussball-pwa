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
  del: vi.fn(async (_id: string) => undefined),
}));
vi.mock('../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: false, isGuest: true, isAnonymous: false }),
}));
vi.mock('../useRepository', () => {
  const repository = { listForCurrentUser: async () => hoisted.repoList, save: hoisted.save, setTrashed: hoisted.setTrashed, delete: hoisted.del };
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

  it('@W5-040 endgültig löschen: das Turnier bleibt aus der Anzeige, auch wenn die Cloud-Liste es bis zur Bestätigung noch kennt', async () => {
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.permanentDeleteTournament('b'); });
    expect(hoisted.del).toHaveBeenCalledWith('b');
    expect(result.current.tournaments.map((t) => t.id)).toEqual(['a']); // die Liste liefert 'b' noch, die Anzeige nicht
    await act(async () => { window.dispatchEvent(new Event('tournament-updated')); });
    await waitFor(() => expect(result.current.tournaments.map((t) => t.id)).toEqual(['a']));
  });

  it('Gegenbeispiel: scheitert das Löschen, steht das Turnier wieder da', async () => {
    hoisted.del.mockRejectedValueOnce(new Error('abgelehnt'));
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await expect(result.current.permanentDeleteTournament('b')).rejects.toThrow('abgelehnt'); });
    await act(async () => { window.dispatchEvent(new Event('tournament-updated')); });
    await waitFor(() => expect(result.current.tournaments.map((t) => t.id)).toEqual(['a', 'b']));
  });

  it('Papierkorb leeren: bestätigte Löschungen verschwinden, das gescheiterte bleibt sichtbar', async () => {
    hoisted.repoList = [eintrag('a', { deletedAt: '2026-11-01T08:00:00.000Z' }), eintrag('b', { deletedAt: '2026-11-01T08:00:00.000Z' })];
    hoisted.del.mockImplementation(async (id: string) => { if (id === 'b') { throw new Error('nein'); } });
    const { result } = renderHook(() => useTournaments());
    await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
    await act(async () => { await result.current.emptyTrash(); });
    expect(result.current.tournaments.map((t) => t.id)).toEqual(['b']);
    hoisted.del.mockImplementation(async () => undefined);
  });
});
