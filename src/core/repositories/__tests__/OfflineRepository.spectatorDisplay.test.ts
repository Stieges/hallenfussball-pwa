/**
 * Aufgabe 2.1 (Spielanzeige, @ZM-152): die Einstellung „Anzeige für Zuschauer“ liegt nur im `tournaments.config`-JSON.
 * Der Delta-Sync (`syncUp`) muss eine Änderung deshalb als strukturelle Änderung erkennen (Voll-Speichern schreibt config),
 * sonst erreicht „Teamfarben aus“ Monitor und Zuschauer-Seite nie.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Tournament } from '../../models/types';
import type { SpectatorDisplaySettings } from '../../models/spectatorDisplay';
import { readWithRevisions } from '../../../test/fakeCloudRepository';

vi.mock('../SupabaseRepository');
vi.mock('../LocalStorageRepository');

const AUS: SpectatorDisplaySettings = { teamColors: false, homeColor: '#1565C0', awayColor: '#C62828' };

function tournament(spectatorDisplay: SpectatorDisplaySettings | undefined, version: number): Tournament {
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
    ...(spectatorDisplay !== undefined ? { spectatorDisplay } : {}),
  } as unknown as Tournament;
}

describe('2.1 OfflineRepository.syncUp: Anzeige für Zuschauer im Delta-Sync', () => {
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

  it('@ZM-152 nur „Teamfarben in den Ergebniskästen“ ausgeschaltet → Voll-Speichern überträgt die Einstellung', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament(AUS, 2)]);
    mockSupabase.get.mockResolvedValue(tournament(undefined, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
    expect((mockSupabase.save.mock.calls[0][0] as Tournament).spectatorDisplay).toEqual(AUS);
  });

  it('@ZM-152 Gegenbeispiel: unveränderte Einstellung löst kein Voll-Speichern aus', async () => {
    mockLocal.listForCurrentUser.mockResolvedValue([tournament(AUS, 2)]);
    mockSupabase.get.mockResolvedValue(tournament({ ...AUS }, 1));

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });
});
