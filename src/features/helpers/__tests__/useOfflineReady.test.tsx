/**
 * „Offline bereit“ (A-17c, @HE-028): Merker nur bei vorhandener lokaler Kopie mit Spielplan.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../core/models/types';
import { clearHelperAccessIndex, findHelperAccessEntry, upsertHelperAccessEntry } from '../helperAccessStore';
import { loadOfflineCopy, useOfflineReady } from '../useOfflineReady';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => memory.get(key) ?? null);
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => { memory.set(key, value); });
  vi.mocked(window.localStorage.removeItem).mockImplementation((key: string) => { memory.delete(key); });
  clearHelperAccessIndex();
  upsertHelperAccessEntry('anon-tom', {
    tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
    closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T10:00:00Z',
  });
});

const tournamentWith = (matchCount: number) => ({ id: 't-cup', matches: Array.from({ length: matchCount }, (_, i) => ({ id: `m${i}` })) }) as unknown as Tournament;

describe('loadOfflineCopy', () => {
  it('Turnier mit Spielplan → bereit', async () => {
    expect(await loadOfflineCopy({ get: async () => tournamentWith(6) }, 't-cup')).toBe(true);
  });

  it('Gegenbeispiele: leerer Spielplan, nicht gefunden, Fehler → nicht bereit', async () => {
    expect(await loadOfflineCopy({ get: async () => tournamentWith(0) }, 't-cup')).toBe(false);
    expect(await loadOfflineCopy({ get: async () => null }, 't-cup')).toBe(false);
    expect(await loadOfflineCopy({ get: async () => { throw new Error('Netz'); } }, 't-cup')).toBe(false);
  });
});

describe('useOfflineReady', () => {
  it('@HE-028 bereit → Anzeige und Merker im Index', async () => {
    const { result } = renderHook(() => useOfflineReady({ get: async () => tournamentWith(6) }, 't-cup', 'anon-tom', { enabled: true }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.offlineReadyAt).toEqual(expect.any(String));
  });

  it('Gegenbeispiel: leeres Turnier → keine Zusage, kein Merker', async () => {
    const get = vi.fn(async () => tournamentWith(0));
    const { result } = renderHook(() => useOfflineReady({ get }, 't-cup', 'anon-tom', { enabled: true }));
    await waitFor(() => expect(get).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.ready).toBe(false);
    expect(findHelperAccessEntry('anon-tom', 't-cup')?.offlineReadyAt).toBeNull();
  });

  it('Gegenbeispiel: nicht aktiviert → lädt nichts', async () => {
    const get = vi.fn(async () => tournamentWith(6));
    renderHook(() => useOfflineReady({ get }, 't-cup', 'anon-tom', { enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
  });
});
