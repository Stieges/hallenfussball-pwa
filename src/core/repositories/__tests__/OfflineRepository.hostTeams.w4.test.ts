/**
 * Fixrunde 1 (Review A2, @W4-034 „über die Cloud übertragbar“): Markierung des Veranstalters und Eröffnungswahl liegen
 * nur im `tournaments.config`-JSON. Der Delta-Sync muss eine Änderung daran als strukturelle Änderung erkennen
 * (Voll-Speichern schreibt config) – sonst erreicht sie die Cloud nie. Muster: OfflineRepository.bibColor.a30a.test.ts.
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

const ROT = '00000000-0000-4000-8000-000000000001';
const BLAU = '00000000-0000-4000-8000-000000000002';

function tournament(extra: Partial<Tournament>, version: number): Tournament {
  return {
    id: 't1',
    title: 'Hallencup Nord',
    date: '2026-10-23',
    status: 'published',
    version,
    teams: [{ id: ROT, name: 'TSV Waging rot', players: [] }, { id: BLAU, name: 'TSV Waging blau', players: [] }],
    matches: [],
    groups: [],
    fields: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...extra,
  } as unknown as Tournament;
}

describe('@W4-034 OfflineRepository.syncUp: Markierung und Eröffnung im Delta-Sync', () => {
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

  it('@W4-034 nur die Markierung geändert → Voll-Speichern überträgt sie in die Cloud', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament({ hostTeamIds: [ROT, BLAU] }, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({ hostTeamIds: [ROT] }, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
    expect((mockSupabase.save.mock.calls[0][0] as Tournament).hostTeamIds).toEqual([ROT, BLAU]);
  });

  it('@W4-034 nur die Eröffnungswahl geändert → Voll-Speichern überträgt sie in die Cloud', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament({ hostTeamIds: [ROT, BLAU], openingMode: 'club-derby' }, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({ hostTeamIds: [ROT, BLAU] }, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
    expect((mockSupabase.save.mock.calls[0][0] as Tournament).openingMode).toBe('club-derby');
  });

  it('@W4-044 Gegenbeispiel: eine verwaiste ID lokal (Team gelöscht) erzwingt kein Voll-Speichern', async () => {
    const teams = [{ id: ROT, name: 'TSV Waging rot', players: [] }];
    mockLocal.listForCurrentUser.mockResolvedValue([tournament({ teams, hostTeamIds: [ROT, BLAU] }, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({ teams, hostTeamIds: [ROT] }, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });

  it('@W4-034 Gegenbeispiel: unveränderte Markierung und Wahl lösen kein Voll-Speichern aus', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament({ hostTeamIds: [ROT], openingMode: 'guest-opening' }, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({ hostTeamIds: [ROT], openingMode: 'guest-opening' }, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });
});
