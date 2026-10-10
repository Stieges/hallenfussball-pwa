/** B-16b1 – Legacy-Datenquelle des Monitors (Cloud zuerst, Timeout, lokaler Rückfall). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { createLegacyMonitorSource } from '../monitorDataSource';

const { supabaseGet, localGet, cfg } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
  cfg: { configured: true },
}));

vi.mock('../../../lib/supabase', () => ({
  get isSupabaseConfigured() { return cfg.configured; },
  supabase: null,
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

const turnier = { id: 'tour-1', monitors: [{ id: 'mon-1', name: 'Haupthalle' }] } as unknown as Tournament;
const lokal = { id: 'tour-1', monitors: [{ id: 'mon-1', name: 'Lokal' }] } as unknown as Tournament;

describe('createLegacyMonitorSource', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cfg.configured = true;
    supabaseGet.mockReset();
    localGet.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Cloud liefert → origin cloud, kein lookupFailed', async () => {
    supabaseGet.mockResolvedValue(turnier);
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toMatchObject({ kind: 'snapshot', origin: 'cloud', lookupFailed: false, version: null, tournament: turnier });
    expect(localGet).not.toHaveBeenCalled();
  });

  it('Cloud null → lokal', async () => {
    supabaseGet.mockResolvedValue(null);
    localGet.mockResolvedValue(lokal);
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toMatchObject({ kind: 'snapshot', origin: 'local', lookupFailed: false, tournament: lokal });
  });

  it('Cloud wirft → lookupFailed true, lokal übernimmt', async () => {
    supabaseGet.mockRejectedValue(new Error('Netz'));
    localGet.mockResolvedValue(lokal);
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toMatchObject({ kind: 'snapshot', origin: 'local', lookupFailed: true });
  });

  it('Cloud hängt → bei 3999 ms noch offen, bei 4000 ms lokal', async () => {
    supabaseGet.mockReturnValue(new Promise(() => undefined));
    localGet.mockResolvedValue(lokal);
    let settled: unknown = null;
    void createLegacyMonitorSource('tour-1', 'mon-1').fetch(null).then((d) => { settled = d; });

    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toMatchObject({ kind: 'snapshot', origin: 'local', lookupFailed: true });
  });

  it('nicht konfiguriert → kein Cloud-Aufruf', async () => {
    cfg.configured = false;
    localGet.mockResolvedValue(lokal);
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(supabaseGet).not.toHaveBeenCalled();
    expect(delta).toMatchObject({ kind: 'snapshot', origin: 'local', lookupFailed: false });
  });

  it('Monitor fehlt → monitor null', async () => {
    localGet.mockResolvedValue(lokal);
    cfg.configured = false;
    const delta = await createLegacyMonitorSource('tour-1', 'mon-x').fetch(null);
    expect(delta).toMatchObject({ kind: 'snapshot', monitor: null });
  });

  it('beide leer → missing, lookupFailed false', async () => {
    supabaseGet.mockResolvedValue(null);
    localGet.mockResolvedValue(null);
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toEqual({ kind: 'missing', lookupFailed: false });
  });

  it('lokal wirft → missing, lookupFailed true', async () => {
    cfg.configured = false;
    localGet.mockRejectedValue(new Error('Storage'));
    const delta = await createLegacyMonitorSource('tour-1', 'mon-1').fetch(null);
    expect(delta).toEqual({ kind: 'missing', lookupFailed: true });
  });
});
