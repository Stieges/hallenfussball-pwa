/**
 * B-19b (@ME-032): Antwort, die der Monitor nicht lesen kann, wird als eigener Befund gemeldet (`unreadable`),
 * nicht als Verbindungsfehler. Netzfehler (RepositoryError) bleiben beim alten Rückfall auf die lokale Kopie
 * (Rückfall ohne Netz bleibt unverändert).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RepositoryError, UnreadableResponseError } from '../../../core/errors';
import { applyDelta, initialDisplayState } from '../monitorDisplayState';
import { buildTournament } from './monitorFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getForDisplay: async (id: string) => { const t: unknown = await supabaseGet(id); return t ? { kind: 'full', version: 1, serverNowMs: 0, tournament: t } : { kind: 'not-found' }; } }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

import { createMonitorSource } from '../monitorDataSource';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monitor-Datenquelle: unlesbare Antwort (B-19b, @ME-032)', () => {
  it('@ME-032: Antwort, die sich nicht abbilden lässt → kind „unreadable“, kein Fehlertext, keine lokale Kopie', async () => {
    supabaseGet.mockRejectedValueOnce(new UnreadableResponseError('get', new TypeError('Cannot read properties of undefined (reading "map")')));
    localGet.mockResolvedValue(buildTournament());
    const delta = await createMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toEqual({ kind: 'unreadable' });
    expect(localGet).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Netzfehler (RepositoryError) bleibt Rückfall auf die lokale Kopie', async () => {
    supabaseGet.mockRejectedValueOnce(new RepositoryError('get', 'Failed to fetch'));
    localGet.mockResolvedValue(buildTournament());
    const delta = await createMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta.kind).toBe('snapshot');
    expect(delta).toMatchObject({ origin: 'local', lookupFailed: true });
  });

  it('lesbare Cloud-Antwort bleibt eine Momentaufnahme aus der Cloud', async () => {
    const tournament = buildTournament();
    supabaseGet.mockResolvedValueOnce(tournament);
    const delta = await createMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toMatchObject({ kind: 'snapshot', origin: 'cloud', lookupFailed: false });
  });

  it('@ME-032: „unreadable“ lässt das letzte Bild unverändert (kein Fehlerzustand)', () => {
    const angezeigt = { ...initialDisplayState, hasData: true, loading: false, lastFetch: 1 };
    const next = applyDelta(angezeigt, { kind: 'unreadable' }, { tournamentId: 'tour-1', monitorId: 'mon-1', now: 2 });
    expect(next).toBe(angezeigt);
    expect(next.error).toBeNull();
  });
});
