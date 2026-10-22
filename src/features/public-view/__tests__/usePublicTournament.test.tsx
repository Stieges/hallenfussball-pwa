/**
 * Hook-Tests für usePublicTournament (B-13b). Quelle eingespeist, außer im Rückfall-Fall
 * (Standard-Quelle über die Repository-Mocks, wie in der B-13a-Screen-Charakterisierung).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
// Konstruktor-Mock als `function`, damit `new SupabaseRepository()` funktioniert.
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { getByShareCode: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: localGet }; }),
}));

import { usePublicTournament } from '../usePublicTournament';
import { createLegacyPublicSource } from '../legacyPublicSource';
import type { PublicTournamentSource } from '../publicSource';

/** Quelle über den heutigen Weg (Adapter (a)); `lookup` zeigt die Aufrufe der Abfrage. */
function sourceOf(...results: Array<Tournament | null | Error>): PublicTournamentSource & { lookup: { getByShareCode: ReturnType<typeof vi.fn> } } {
  const getByShareCode = vi.fn();
  for (const r of results) {
    if (r instanceof Error) {
      getByShareCode.mockRejectedValueOnce(r);
    } else {
      getByShareCode.mockResolvedValueOnce(r);
    }
  }
  return Object.assign(createLegacyPublicSource({ getByShareCode }), { lookup: { getByShareCode } });
}

describe('usePublicTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lädt über die eingespeiste Quelle: Turnier, Spielplan und Tabellen, Zustand success', async () => {
    const t = buildLiveViewTournament();
    const source = sourceOf(t);
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));

    expect(result.current.loadingState).toBe('loading');
    await waitFor(() => expect(result.current.loadingState).toBe('success'));

    expect(source.lookup.getByShareCode).toHaveBeenCalledWith(SHARE_CODE);
    expect(result.current.tournament?.id).toBe(t.id);
    expect(result.current.schedule).not.toBeNull();
    expect(result.current.standings.length).toBeGreaterThan(0);
    expect(result.current.errorMessage).toBeNull();
  });

  it('Quelle liefert null → Zustand not-found, kein Turnier', async () => {
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, sourceOf(null)));
    await waitFor(() => expect(result.current.loadingState).toBe('not-found'));
    expect(result.current.tournament).toBeNull();
    expect(result.current.schedule).toBeNull();
  });

  it('Gegenbeispiel (a): Supabase wirft → lokaler Rückfall liefert Turnier, Zustand success, nicht not-found', async () => {
    const t = buildLiveViewTournament();
    supabaseGet.mockRejectedValue(new Error('netz weg'));
    localGet.mockResolvedValue(t);

    const { result } = renderHook(() => usePublicTournament(SHARE_CODE));
    await waitFor(() => expect(result.current.loadingState).toBe('success'));

    expect(supabaseGet).toHaveBeenCalledWith(SHARE_CODE);
    expect(localGet).toHaveBeenCalledWith(SHARE_CODE);
    expect(result.current.tournament?.id).toBe(t.id);
  });

  it('Standard-Quelle: Supabase liefert null → lokaler Rückfall', async () => {
    const t = buildLiveViewTournament();
    supabaseGet.mockResolvedValue(null);
    localGet.mockResolvedValue(t);

    const { result } = renderHook(() => usePublicTournament(SHARE_CODE));
    await waitFor(() => expect(result.current.loadingState).toBe('success'));
    expect(localGet).toHaveBeenCalledTimes(1);
  });

  it('Standard-Quelle: beide Quellen null → not-found', async () => {
    supabaseGet.mockResolvedValue(null);
    localGet.mockResolvedValue(null);

    const { result } = renderHook(() => usePublicTournament(SHARE_CODE));
    await waitFor(() => expect(result.current.loadingState).toBe('not-found'));
  });

  it('Gegenbeispiel (b): refresh() mit werfender Auswertung lässt Zustand auf success, Fehlertext bleibt leer', async () => {
    const t = buildLiveViewTournament();
    const broken = { ...t, teams: undefined } as unknown as Tournament;
    const source = sourceOf(t, broken);
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));
    await waitFor(() => expect(result.current.loadingState).toBe('success'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(source.lookup.getByShareCode).toHaveBeenCalledTimes(2);
    expect(result.current.loadingState).toBe('success');
    expect(result.current.errorMessage).toBeNull();
  });

  it('refresh() setzt keinen Ladezustand (kein Flackern der Seite)', async () => {
    const t = buildLiveViewTournament();
    const source = sourceOf(t, t);
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));
    await waitFor(() => expect(result.current.loadingState).toBe('success'));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.loadingState).toBe('success');
    await act(async () => {
      await pending;
    });
    expect(source.lookup.getByShareCode).toHaveBeenCalledTimes(2);
  });

  // Befund „Ladefehler als nicht gefunden“ (B-41 Fixrunde 2): eine Störung ist nie „nicht gefunden“ (@ZM-109)
  it('@ZM-109 Quelle wirft → „Fehler beim Laden“, nicht „nicht gefunden“, ohne Absturz', async () => {
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE, sourceOf(new Error('kaputt'))));
    await waitFor(() => expect(result.current.loadingState).toBe('error'));
    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.tournament).toBeNull();
  });

  it('@ZM-109 Supabase wirft und der lokale Speicher hat nichts → „Fehler beim Laden“', async () => {
    supabaseGet.mockRejectedValue(new Error('netz weg'));
    localGet.mockResolvedValue(null);
    const { result } = renderHook(() => usePublicTournament(SHARE_CODE));
    await waitFor(() => expect(result.current.loadingState).toBe('error'));
  });
});
