/**
 * A-30a Fixrunde 2 (Nachreview B2, @W3-029): die Leibchenfarbe liegt nur im `tournaments.config`-JSON und hat keine
 * eigene Spalte. Der Delta-Sync (`syncUp` → `syncTournamentDelta`) muss eine geänderte Farbe deshalb als strukturelle
 * Änderung erkennen (Voll-Speichern schreibt config) – sonst erreicht eine Änderung am Turniertag die Cloud nie.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Tournament } from '../../models/types';
import { readWithRevisions } from '../../../test/fakeCloudRepository';

vi.mock('../SupabaseRepository');
vi.mock('../LocalStorageRepository');

function tournament(bibColor: string | undefined, version: number): Tournament {
  return {
    id: 't1',
    title: 'Hallencup Nord',
    date: '2026-10-23',
    status: 'published',
    version,
    teams: [],
    matches: [],
    groups: [],
    fields: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...(bibColor !== undefined ? { bibColor } : {}),
  } as unknown as Tournament;
}

describe('A-30a OfflineRepository.syncUp: Leibchenfarbe im Delta-Sync', () => {
  let offlineRepo: OfflineRepository;
  let mockSupabase: {
    get: Mock<(id: string) => Promise<Tournament | null>>;
    getWithMatchRevisions: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    updateTournamentMetadata: ReturnType<typeof vi.fn>;
  };
  let mockLocal: { listForCurrentUser: ReturnType<typeof vi.fn>; updateLocalVersion: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = new SupabaseRepository() as unknown as typeof mockSupabase;
    mockLocal = new LocalStorageRepository() as unknown as typeof mockLocal;
    mockLocal.updateLocalVersion.mockResolvedValue(undefined);
    mockSupabase.save.mockResolvedValue(undefined);
    mockSupabase.getWithMatchRevisions.mockImplementation(readWithRevisions((id: string) => mockSupabase.get(id)));
    mockSupabase.updateTournamentMetadata.mockResolvedValue(undefined);
    offlineRepo = new OfflineRepository(
      mockLocal as unknown as LocalStorageRepository,
      mockSupabase as unknown as SupabaseRepository,
    );
  });

  afterEach(() => {
    offlineRepo.mutationQueue.dispose();
  });

  it('@W3-029 nur die Leibchenfarbe geändert (Gelb → Orange) → Voll-Speichern überträgt sie in die Cloud', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament('#FF6600', 2)]);
    mockSupabase.get.mockResolvedValue(tournament(undefined, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
    expect((mockSupabase.save.mock.calls[0][0] as Tournament).bibColor).toBe('#FF6600');
  });

  it('@W3-029 Gegenbeispiel: unveränderte Leibchenfarbe (nur andere Schreibweise) löst kein Voll-Speichern aus', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament('#ff6600', 2)]);
    mockSupabase.get.mockResolvedValue(tournament('#FF6600', 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });
});
