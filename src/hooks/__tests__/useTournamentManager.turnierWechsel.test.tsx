/**
 * @HE-086, @HE-085 („Aber“ Kopie fürs Proben): Öffnet Maria aus dem Original heraus die Adresse eines Turniers, in dem sie
 * nicht eingetragen ist, sieht sie dieselbe Seite wie bei einem Turnier, das es nicht gibt – nie den Inhalt des Originals.
 * Wackler CA-7 Z5 (coadmin-einsatz.cloud.spec.ts:397, CI-Lauf 42317025618): das Fenster wird beim Wechsel der Turnier-Adresse
 * nicht neu aufgebaut; ein noch laufendes frisches Laden des Originals (nach dem Tor) kam nach „Nicht gefunden“ der Kopie an
 * und überschrieb es – das Gerät zeigte unter der Adresse der Kopie das Original.
 * Mocks wie useTournamentManager.speichernWirft.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';
import { looseVs } from '../../test/matchSlotFixtures';

const mockLoadTournament = vi.fn();
const mockUpdateTournament = vi.fn();

vi.mock('../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = mockUpdateTournament;
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});

const STABLE_TOURNAMENT_REPOSITORY = {};
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: STABLE_TOURNAMENT_REPOSITORY, isRealtimeEnabled: false }),
}));
vi.mock('../useRealtimeTournament', () => ({
  useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }),
}));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => null,
}));

const ORIGINAL = 'original';
const KOPIE = 'kopie';

function makeTournament(id: string, title: string): Tournament {
  return {
    id,
    title,
    matches: [
      { id: `${id}-m1`, round: 1, field: 1, ...looseVs('teamA', 'teamB'), scoreA: 1, scoreB: 0, matchStatus: 'running', scheduledTime: new Date('2026-11-07T10:00:00.000Z') },
    ],
    teams: [
      { id: 'teamA', name: 'Heim' },
      { id: 'teamB', name: 'Gast' },
    ],
    placementLogic: [],
    groupPhaseGameDuration: 10,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    numberOfFields: 1,
    version: 3,
  } as unknown as Tournament;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('@HE-086 @HE-085 useTournamentManager: Wechsel auf die Adresse eines anderen Turniers', () => {
  beforeEach(() => {
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
  });

  async function originalOffen() {
    mockLoadTournament.mockResolvedValueOnce(makeTournament(ORIGINAL, 'Original'));
    const rendered = renderHook(({ id }) => useTournamentManager(id), { initialProps: { id: ORIGINAL } });
    await waitFor(() => expect(rendered.result.current.tournament?.title).toBe('Original'));
    return rendered;
  }

  it('ein spät ankommendes Laden des Originals überschreibt „nicht gefunden“ der Kopie nicht', async () => {
    const rendered = await originalOffen();
    // Push nach dem Tor: frisches Laden des Originals läuft noch
    const spaet = deferred<Tournament | null>();
    mockLoadTournament.mockReturnValueOnce(spaet.promise);
    act(() => { void rendered.result.current.reload({ fresh: true }); });

    // Maria öffnet die Adresse der Kopie (kein Zugang -> der Server kennt sie für Maria nicht)
    mockLoadTournament.mockResolvedValueOnce(null);
    rendered.rerender({ id: KOPIE });
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(rendered.result.current.tournament).toBeNull();

    await act(async () => { spaet.resolve(makeTournament(ORIGINAL, 'Original')); await spaet.promise; });
    expect(rendered.result.current.tournament, 'unter der Adresse der Kopie nie das Original').toBeNull();
    expect(rendered.result.current.isLoading).toBe(false);
    expect(rendered.result.current.loadingError).toBeNull();
  });

  it('solange die Kopie lädt, steht nicht der Inhalt des Originals da', async () => {
    const rendered = await originalOffen();
    const kopieLaedt = deferred<Tournament | null>();
    mockLoadTournament.mockReturnValueOnce(kopieLaedt.promise);
    rendered.rerender({ id: KOPIE });
    expect(rendered.result.current.tournament, 'kein Original unter der Adresse der Kopie').toBeNull();
    expect(rendered.result.current.isLoading).toBe(true);
    await act(async () => { kopieLaedt.resolve(null); await kopieLaedt.promise; });
    expect(rendered.result.current.isLoading).toBe(false);
  });

  it('ein Fehler beim späten Laden des Originals erscheint nicht unter der Adresse der Kopie', async () => {
    const rendered = await originalOffen();
    const spaet = deferred<Tournament | null>();
    mockLoadTournament.mockReturnValueOnce(spaet.promise.then(() => { throw new Error('Netz weg'); }));
    act(() => { void rendered.result.current.reload({ fresh: true }); });
    mockLoadTournament.mockResolvedValueOnce(makeTournament(KOPIE, 'Kopie'));
    rendered.rerender({ id: KOPIE });
    await waitFor(() => expect(rendered.result.current.tournament?.title).toBe('Kopie'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => { spaet.resolve(null); await spaet.promise.catch(() => undefined); await Promise.resolve(); });
    expect(rendered.result.current.loadingError).toBeNull();
    expect(rendered.result.current.tournament?.title).toBe('Kopie');
  });

  it('endet das Laden des Originals, während die Kopie noch lädt, bleibt die Laden-Anzeige (kein vorzeitiges „Nicht gefunden“)', async () => {
    const originalLaedt = deferred<Tournament | null>();
    mockLoadTournament.mockReturnValueOnce(originalLaedt.promise);
    const rendered = renderHook(({ id }) => useTournamentManager(id), { initialProps: { id: ORIGINAL } });
    const kopieLaedt = deferred<Tournament | null>();
    mockLoadTournament.mockReturnValueOnce(kopieLaedt.promise);
    rendered.rerender({ id: KOPIE });
    await act(async () => { originalLaedt.resolve(makeTournament(ORIGINAL, 'Original')); await originalLaedt.promise; });
    expect(rendered.result.current.isLoading, 'die Kopie lädt noch').toBe(true);
    expect(rendered.result.current.tournament).toBeNull();
    await act(async () => { kopieLaedt.resolve(null); await kopieLaedt.promise; });
    expect(rendered.result.current.isLoading).toBe(false);
  });

  it('ein spät bestätigtes Speichern des Originals erscheint nicht unter der Adresse der Kopie', async () => {
    const rendered = await originalOffen();
    const gespeichert = deferred<undefined>();
    mockUpdateTournament.mockReturnValueOnce(gespeichert.promise);
    let speichern: Promise<void> = Promise.resolve();
    act(() => { speichern = rendered.result.current.handleTournamentUpdate({ ...rendered.result.current.tournament!, title: 'Original geändert' }); });
    mockLoadTournament.mockResolvedValueOnce(null);
    rendered.rerender({ id: KOPIE });
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    await act(async () => { gespeichert.resolve(undefined); await speichern; });
    expect(rendered.result.current.tournament, 'unter der Adresse der Kopie nie das Original').toBeNull();
  });

  it('Gegenbeispiel: dieselbe Adresse – ein frisches Laden kommt an', async () => {
    const rendered = await originalOffen();
    mockLoadTournament.mockResolvedValueOnce(makeTournament(ORIGINAL, 'Original neu'));
    await act(async () => { await rendered.result.current.reload({ fresh: true }); });
    expect(rendered.result.current.tournament?.title).toBe('Original neu');
  });

  it('Gegenbeispiel: zurück zum Original – es wird wieder geladen und gezeigt', async () => {
    const rendered = await originalOffen();
    mockLoadTournament.mockResolvedValueOnce(null);
    rendered.rerender({ id: KOPIE });
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    mockLoadTournament.mockResolvedValueOnce(makeTournament(ORIGINAL, 'Original'));
    rendered.rerender({ id: ORIGINAL });
    await waitFor(() => expect(rendered.result.current.tournament?.title).toBe('Original'));
  });
});
