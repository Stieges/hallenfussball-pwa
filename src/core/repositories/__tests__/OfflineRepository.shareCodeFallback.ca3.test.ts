/**
 * CA-3 (Paket Co-Admin, Befund C-SHARE): Rückfall des Teilens ohne Netz bzw. mit alter Server-Funktion.
 * Anforderungen: @BM-070 (Rückfall-Pfad; „der Freigabe-Code bleibt derselbe“), @BM-071 (Code vorlesbar, auch bei Netzausfall
 * mitten im Teilen), Plan-Review Auflage 5 (Rückfall überschreibt keinen Code, den das Gerät aus der Cloud kennt) und Review CA-3–5
 * Auflage 2 (… auch keinen, den das Gerät NICHT kennt: Senden nur, wenn die Cloud-Zeile noch keinen Code hat).
 * Der Client muss mit alter UND neuer Server-Funktion arbeiten: Ablehnung "Not authorized" (alt, Co-Admin) und
 * Erfolg (neu) werden beide bedient.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import { RepositoryError } from '../../errors';
import { createMockTournament } from '../../../test/factories';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(structuredClone(stores.raw.get(key))),
      set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
    }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })) } } }));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const SERVER_FORMAT = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const updateMetadata = vi.fn<(id: string, metadata: Record<string, unknown>) => Promise<void>>();
const cloudMakePublic = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();
const cloudRegenerate = vi.fn<(id: string) => Promise<{ shareCode: string; createdAt: string } | null>>();
type ShareResult = { applied: true } | { applied: false; cloud: { isPublic: boolean; shareCode?: string; shareCodeCreatedAt?: string } | null };
const cloudShareIfUnshared = vi.fn<(id: string, share: { shareCode: string; shareCodeCreatedAt?: string }) => Promise<ShareResult>>();

let repo: OfflineRepository | undefined;
let online = false;

function localTournaments(): Tournament[] { return stores.raw.get('tournaments') as Tournament[]; }
function pendingMetadata(): Array<Record<string, unknown>> {
  const queue = JSON.parse(stores.queue.get('mutation_queue_v1') ?? '[]') as Array<{ type: string; payload: { metadata: Record<string, unknown> } }>;
  return queue.filter((i) => i.type === 'UPDATE_TOURNAMENT_METADATA').map((i) => i.payload.metadata);
}

function setup(): OfflineRepository {
  const cloud = {
    makeTournamentPublic: cloudMakePublic,
    regenerateShareCode: cloudRegenerate,
    updateTournamentMetadata: updateMetadata,
    shareIfUnshared: cloudShareIfUnshared,
  };
  repo = new OfflineRepository(new LocalStorageRepository(), cloud as never);
  return repo;
}

describe('CA-3 OfflineRepository: Rückfall des Teilens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.raw.clear();
    stores.queue.clear();
    online = false;
    vi.stubGlobal('navigator', { get onLine() { return online; } });
    stores.raw.set('tournaments', [createMockTournament({ id: 'T', sportId: 'football-indoor', isPublic: false, version: 3 })]);
    updateMetadata.mockResolvedValue(undefined);
    cloudShareIfUnshared.mockResolvedValue({ applied: true });
  });
  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
  });

  it('@BM-071: Netzausfall mitten im Teilen → vorläufiger Code im Server-Format, mit Zeitpunkt, in der Warteschlange', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const result = await setup().makeTournamentPublic('T');

    expect(result?.shareCode).toMatch(SERVER_FORMAT);
    expect(localTournaments()[0]).toMatchObject({ isPublic: true, shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt });
    expect(pendingMetadata()).toEqual([{ isPublic: true, shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt }]);
  });

  it('alte Server-Funktion: Co-Admin wird mit "Not authorized" abgelehnt → Rückfall wie bei Netzausfall (kein Absturz)', async () => {
    cloudMakePublic.mockRejectedValue(new RepositoryError('makePublic', 'Not authorized to modify this tournament', { code: 'P0001' }));
    const result = await setup().makeTournamentPublic('T');

    expect(result?.shareCode).toMatch(SERVER_FORMAT);
    expect(pendingMetadata()).toHaveLength(1);
  });

  it('neue Server-Funktion: Erfolg → Servercode wird übernommen, nichts in der Warteschlange, Zeitpunkt vom Server', async () => {
    online = true;
    cloudMakePublic.mockResolvedValue({ shareCode: 'SRV234', createdAt: '2026-11-01T10:00:00.000Z' });
    const result = await setup().makeTournamentPublic('T');

    expect(result).toEqual({ shareCode: 'SRV234', createdAt: '2026-11-01T10:00:00.000Z' });
    expect(localTournaments()[0]).toMatchObject({ isPublic: true, shareCode: 'SRV234', shareCodeCreatedAt: '2026-11-01T10:00:00.000Z' });
    expect(pendingMetadata()).toEqual([]);
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('Freigabe-Sperre (HF001) wird weiter durchgereicht, der Rückfall teilt dann nicht', async () => {
    cloudMakePublic.mockRejectedValue(new RepositoryError('makePublic', 'nicht freigegeben', { code: 'HF001' }));
    await expect(setup().makeTournamentPublic('T')).rejects.toThrow(/nicht freigegeben/);
    expect(localTournaments()[0].isPublic).toBe(false);
    expect(pendingMetadata()).toEqual([]);
  });

  it('Auflage 5: kennt das Gerät den Cloud-Code schon, überschreibt der Rückfall ihn nicht (keine Warteschlange)', async () => {
    stores.raw.set('tournaments', [createMockTournament({ id: 'T', sportId: 'football-indoor', isPublic: true, shareCode: 'CLD234', shareCodeCreatedAt: '2026-10-01T08:00:00.000Z' })]);
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const result = await setup().makeTournamentPublic('T');

    expect(result).toEqual({ shareCode: 'CLD234', createdAt: '2026-10-01T08:00:00.000Z' });
    expect(localTournaments()[0].shareCode).toBe('CLD234');
    expect(pendingMetadata()).toEqual([]);
  });

  it('regenerate ohne Netz: neuer Code im Server-Format, mit Zeitpunkt in der Warteschlange', async () => {
    stores.raw.set('tournaments', [createMockTournament({ id: 'T', sportId: 'football-indoor', isPublic: true, shareCode: 'OLD234', shareCodeCreatedAt: '2026-10-01T08:00:00.000Z' })]);
    cloudRegenerate.mockRejectedValue(new Error('Failed to fetch'));
    const result = await setup().regenerateShareCode('T');

    expect(result?.shareCode).toMatch(SERVER_FORMAT);
    expect(result?.shareCode).not.toBe('OLD234');
    expect(pendingMetadata()).toEqual([{ shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt }]);
  });

  it('Senden nach Netz-Rückkehr: share_code und Zeitpunkt gehen in einem Schritt an die Cloud, bedingt (nur ohne Cloud-Code)', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const r = setup();
    const result = await r.makeTournamentPublic('T');

    online = true;
    await r.mutationQueue.process();

    expect(cloudShareIfUnshared).toHaveBeenCalledWith('T', { shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt });
    expect(updateMetadata).not.toHaveBeenCalled();
    expect(r.mutationQueue.getPendingCount()).toBe(0);
  });

  it('@BM-070 Kopie nicht geteilt, Olli hat in der Cloud schon geteilt (OLI234): der Rückfall ändert den Code nicht, das Gerät zeigt OLI234', async () => {
    const cloudRow = { isPublic: true, shareCode: 'OLI234' as string | undefined, shareCodeCreatedAt: '2026-10-01T08:00:00.000Z' };
    cloudShareIfUnshared.mockImplementation(async (_id, share) => {
      if (cloudRow.shareCode !== undefined) { return { applied: false, cloud: { ...cloudRow } }; }
      Object.assign(cloudRow, { isPublic: true, shareCode: share.shareCode, shareCodeCreatedAt: share.shareCodeCreatedAt });
      return { applied: true };
    });
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const r = setup();
    await r.makeTournamentPublic('T');

    online = true;
    await r.mutationQueue.process();

    expect(cloudRow.shareCode).toBe('OLI234');
    expect(localTournaments()[0]).toMatchObject({ isPublic: true, shareCode: 'OLI234', shareCodeCreatedAt: '2026-10-01T08:00:00.000Z' });
    expect(updateMetadata).not.toHaveBeenCalled();
    expect(r.mutationQueue.getPendingCount()).toBe(0);
    expect(r.mutationQueue.getFailedCount()).toBe(0);
  });

  it('@BM-070 Gegenbeispiel: hat die Cloud noch keinen Code, setzt der Rückfall den Code des Geräts', async () => {
    const cloudRow = { isPublic: false, shareCode: undefined as string | undefined, shareCodeCreatedAt: undefined as string | undefined };
    cloudShareIfUnshared.mockImplementation(async (_id, share) => {
      if (cloudRow.shareCode !== undefined) { return { applied: false, cloud: { ...cloudRow } }; }
      Object.assign(cloudRow, { isPublic: true, shareCode: share.shareCode, shareCodeCreatedAt: share.shareCodeCreatedAt });
      return { applied: true };
    });
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const r = setup();
    const result = await r.makeTournamentPublic('T');

    online = true;
    await r.mutationQueue.process();

    expect(cloudRow).toEqual({ isPublic: true, shareCode: result?.shareCode, shareCodeCreatedAt: result?.createdAt });
    expect(localTournaments()[0].shareCode).toBe(result?.shareCode);
  });

  it('Kollision am Server (23505 auf share_code): der Eintrag ist nicht still weg, er steht im Dead-Letter', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    cloudShareIfUnshared.mockRejectedValue(new RepositoryError('updateMetadata', 'duplicate key value violates unique constraint "tournaments_share_code_key"', { code: '23505' }));
    const r = setup();
    await r.makeTournamentPublic('T');

    online = true;
    for (let i = 0; i < 6; i++) { await r.mutationQueue.process(); }

    expect(r.mutationQueue.getPendingCount()).toBe(0);
    expect(r.mutationQueue.getFailedCount()).toBe(1);
    expect(r.mutationQueue.getFailedMutations()[0]).toMatchObject({ type: 'UPDATE_TOURNAMENT_METADATA' });
    expect(r.mutationQueue.getFailedMutations()[0].lastError).toMatch(/share_code_key/);
  });

  it('Gegenbeispiel Kollision: ohne Fehler am Server bleibt der Dead-Letter leer', async () => {
    cloudMakePublic.mockRejectedValue(new Error('Failed to fetch'));
    const r = setup();
    await r.makeTournamentPublic('T');
    online = true;
    await r.mutationQueue.process();
    expect(r.mutationQueue.getFailedCount()).toBe(0);
  });
});
