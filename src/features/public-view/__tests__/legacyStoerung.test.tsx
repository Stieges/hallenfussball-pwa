/**
 * B-15 Review M1: der echte Adapter (a) mit dem echten SupabaseRepository unterscheidet eine Störung von „0 Zeilen“.
 * Nur der Supabase-Client ist ein Stub: Netzfehler liefern wie bei postgrest-js `{ error }`, nie eine Ausnahme.
 */
import { describe, it, expect, vi } from 'vitest';

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
  return { isSupabaseConfigured: true, supabase: { from: () => query(), rpc: () => Promise.resolve({ data: null, error: { message: 'x' } }) } };
});
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { getByShareCode: () => Promise.resolve(null) }; }),
}));

import { createLegacyPublicSource } from '../legacyPublicSource';

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
