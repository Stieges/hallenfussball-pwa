/**
 * K1 (Kurzblick S2): vier Felder liegen nur im `tournaments.config`-JSON – spectatorDisplay (@ZM-152), hostTeamIds und
 * openingMode (@W4-034), bibColor (@W3-029). Der Delta-Sync (`syncUp`) muss die Änderung genau EINES Felds als strukturelle
 * Änderung erkennen (Voll-Speichern), auch wenn die anderen drei gesetzt und unverändert sind; sind alle unverändert, kein
 * Voll-Speichern. Muster: OfflineRepository.spectatorDisplay.test.ts, OfflineRepository.hostTeams.w4.test.ts.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Tournament } from '../../models/types';
import { readWithRevisions } from '../../../test/fakeCloudRepository';
import { palette } from '../../../design-tokens/colors/palette';

vi.mock('../SupabaseRepository');
vi.mock('../LocalStorageRepository');

const ROT = '00000000-0000-4000-8000-000000000001';
const BLAU = '00000000-0000-4000-8000-000000000002';

/** Alle vier config-Felder gesetzt; `extra` überschreibt einzelne. */
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
    spectatorDisplay: { teamColors: true, homeColor: palette.kit.blue, awayColor: palette.kit.red },
    hostTeamIds: [ROT],
    openingMode: 'club-derby',
    bibColor: '#FF6600',
    ...extra,
  } as unknown as Tournament;
}

describe('K1 OfflineRepository.syncUp: vier config-Felder im Delta-Sync', () => {
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

  const aenderungen: Array<[string, Partial<Tournament>]> = [
    ['spectatorDisplay', { spectatorDisplay: { teamColors: false, homeColor: palette.kit.blue, awayColor: palette.kit.red } }],
    ['hostTeamIds', { hostTeamIds: [ROT, BLAU] }],
    ['openingMode', { openingMode: 'guest-opening' }],
    ['bibColor', { bibColor: '#00AA55' }],
  ];

  it.each(aenderungen)('K1 nur %s geändert (die anderen drei gesetzt und gleich) → Voll-Speichern', async (_name, aenderung) => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament(aenderung, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({}, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
    expect(mockSupabase.save.mock.calls[0][0]).toMatchObject(aenderung);
  });

  it('K1 Gegenbeispiel: alle vier gesetzt und unverändert → kein Voll-Speichern', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament({}, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({}, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });
});
