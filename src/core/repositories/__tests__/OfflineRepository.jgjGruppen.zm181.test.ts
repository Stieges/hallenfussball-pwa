/**
 * @ZM-181 (Review PR #419, 🟡2): Eine lokale Bestandskopie von „Jeder gegen jeden“ mit den früher gespeicherten Standardgruppen A/B ist
 * gegen die Cloud-Lesung (ohne Gruppen, siehe `groupsOfSystem`) keine strukturelle Änderung – eine reine Titeländerung läuft als
 * Metadaten-Delta, nicht als Voll-Save. Bei Gruppen + Finalrunde bleibt ein Unterschied der Gruppen strukturell.
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

function tournament(groupSystem: string, groups: unknown[], title: string, version: number): Tournament {
  return {
    id: 't1', title, date: '2026-10-23', status: 'published', version, groupSystem, teams: [], matches: [], groups, fields: [],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  } as unknown as Tournament;
}

describe('@ZM-181 OfflineRepository.syncUp: Standardgruppen bei Jeder gegen jeden', () => {
  let offlineRepo: OfflineRepository;
  let mockSupabase: {
    get: Mock<(id: string) => Promise<Tournament | null>>;
    getWithMatchRevisions: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    updateTournamentMetadata: ReturnType<typeof vi.fn>;
  };
  let mockLocal: { listForCurrentUser: ReturnType<typeof vi.fn>; updateLocalVersion: ReturnType<typeof vi.fn>; confirmUpload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = new SupabaseRepository() as unknown as typeof mockSupabase;
    mockLocal = new LocalStorageRepository() as unknown as typeof mockLocal;
    mockLocal.updateLocalVersion.mockResolvedValue(undefined);
    mockLocal.confirmUpload.mockResolvedValue(undefined);
    mockSupabase.save.mockResolvedValue(undefined);
    mockSupabase.getWithMatchRevisions.mockImplementation(readWithRevisions((id: string) => mockSupabase.get(id)));
    mockSupabase.updateTournamentMetadata.mockResolvedValue(undefined);
    offlineRepo = new OfflineRepository(mockLocal as unknown as LocalStorageRepository, mockSupabase as unknown as SupabaseRepository);
  });
  afterEach(() => { offlineRepo.mutationQueue.dispose(); });

  const AB = [{ id: 'A' }, { id: 'B' }];

  it('Jeder gegen jeden, lokal mit Gruppen A/B, Cloud ohne: nur der Titel geändert -> Metadaten-Delta, kein Voll-Save', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament('roundRobin', AB, 'Neuer Titel', 2)]);
    mockSupabase.get.mockResolvedValue(tournament('roundRobin', undefined as never, 'Hallencup Nord', 1));
    await offlineRepo.syncUp();
    expect(mockSupabase.save).not.toHaveBeenCalled();
    expect(mockSupabase.updateTournamentMetadata).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: bei Gruppen + Finalrunde ist ein Unterschied der Gruppen eine strukturelle Änderung -> Voll-Save', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament('groupsAndFinals', AB, 'Hallencup Nord', 2)]);
    mockSupabase.get.mockResolvedValue(tournament('groupsAndFinals', [{ id: 'A' }], 'Hallencup Nord', 1));
    await offlineRepo.syncUp();
    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
  });
});
