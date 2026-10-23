/**
 * B-15 Review M1: der echte Adapter (a) mit dem echten SupabaseRepository unterscheidet eine Störung von „0 Zeilen“.
 * Nur der Supabase-Client ist ein Stub: Netzfehler liefern wie bei postgrest-js `{ error }`, nie eine Ausnahme.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

interface Answer { data: unknown; error: { code?: string; message: string } | null }
const { state } = vi.hoisted<{ state: { single: Answer; probe: Answer } }>(() => ({
  state: {
    single: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    probe: { data: [], error: null },
  },
}));
vi.mock('../../../lib/supabase', () => {
  const query = (): Record<string, unknown> => {
    const q: Record<string, unknown> = {
      select: (columns: string) => { q.columns = columns; return q; },
      eq: () => q,
      order: () => q,
      single: () => Promise.resolve(state.single),
      limit: () => Promise.resolve(state.probe),
    };
    return q;
  };
  // Seit B-14 liest getByShareCode über die Server-Funktion public_tournament: „0 Zeilen“ (PGRST116) entspricht dort
  // {state:'not_found'}, jeder andere Fehler bleibt ein Fehler der Anfrage (@ZM-068, @ZM-109).
  const rpc = (): Promise<Answer> => Promise.resolve(
    state.single.error?.code === 'PGRST116'
      ? { data: { state: 'not_found' }, error: null }
      : { data: null, error: state.single.error },
  );
  return { isSupabaseConfigured: true, supabase: { from: () => query(), rpc } };
});
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: () => Promise.resolve(null) }; }),
}));

import { createLegacyPublicSource } from '../legacyPublicSource';
import { usePublicTournament } from '../usePublicTournament';
import { buildLiveViewTournament } from '../../../screens/__tests__/liveViewFixture';
import { contentVersionOf } from '../publicVersion';
import type { StandStorage } from '../publicStandStore';

const source = createLegacyPublicSource(undefined, { clock: { nowMs: () => Date.now() } });

describe('Adapter (a) mit dem echten Repository', () => {
  it('@ZM-109 Netzfehler beim ersten Laden ist „nicht erreichbar“, nicht „nicht gefunden“', async () => {
    state.single = { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } };
    state.probe = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    expect(await source.fetch('ABC123', null)).toEqual({ kind: 'unreachable' });
  });

  it('@ZM-109 Serverfehler 5xx beim ersten Laden ist „nicht erreichbar“', async () => {
    state.single = { data: null, error: { code: '', message: 'upstream request timeout' } };
    state.probe = { data: null, error: { message: 'upstream request timeout' } };
    expect(await source.fetch('ABC123', null)).toEqual({ kind: 'unreachable' });
  });

  it('@ZM-109 getByShareCode liefert null, die Zusatzabfrage aber 1 Zeile: nur kurz gestört, also „nicht erreichbar“', async () => {
    state.single = { data: null, error: { code: '', message: 'Failed to fetch' } };
    state.probe = { data: [{ id: 'abc' }], error: null };
    expect(await source.fetch('ABC123', null)).toEqual({ kind: 'unreachable' });
  });

  it('@ZM-109 Gegenbeispiel: 0 Zeilen (Turnier nicht freigegeben) bleibt „nicht gefunden“', async () => {
    state.single = { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    state.probe = { data: [], error: null };
    expect(await source.fetch('ABC123', null)).toEqual({ kind: 'not-found' });
  });
});

describe('Adapter (a) mit gespeichertem Stand (@ZM-036, @ZM-109)', () => {
  const memory = (): StandStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
  };
  const withStand = () => {
    const storage = memory();
    const tournament = buildLiveViewTournament();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    storage.setItem('publicStand:v1:ABC123', JSON.stringify({ source: 'legacy', version: contentVersionOf(tournament), day: today, tournament }));
    return storage;
  };

  it('@ZM-036 Teilen zurückgenommen (Zusatzabfrage 0 Zeilen): „nicht gefunden“, der gespeicherte Stand ist gelöscht', async () => {
    state.single = { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    state.probe = { data: [], error: null };
    const storage = withStand();
    expect(await source.fetch('ABC123', 'v')).toEqual({ kind: 'not-found' });
    const { result } = renderHook(() => usePublicTournament('ABC123', source, { storage }));
    await waitFor(() => expect(result.current.loadingState).toBe('not-found'));
    expect(storage.getItem('publicStand:v1:ABC123')).toBeNull();
  });

  it('@ZM-109 Gegenbeispiel: mit Stand und Netzfehler bleibt der Stand stehen, mit Hinweis statt „nicht gefunden“', async () => {
    state.single = { data: null, error: { code: '', message: 'Failed to fetch' } };
    state.probe = { data: null, error: { message: 'Failed to fetch' } };
    const storage = withStand();
    const { result } = renderHook(() => usePublicTournament('ABC123', source, { storage }));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(result.current.loadingState).toBe('success');
    expect(storage.getItem('publicStand:v1:ABC123')).not.toBeNull();
  });
});
