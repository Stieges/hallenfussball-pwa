/**
 * A-02 (MVP-Bauplan Spur A, GA1): Der Delta-Sync (`syncUp` → `syncTournamentDelta`) erkennt eine
 * geänderte BESETZTE Spielseite als strukturelle Änderung und schickt das Turnier per Voll-Speichern
 * – sonst erreicht ein lokaler Teamtausch die Cloud nie (gleiche Spiel-IDs, gleiche Teams).
 * Eine lokal OFFENE Seite gegen eine in der Cloud besetzte ist KEINE Änderung: der lokale Stand ist
 * nur veraltet (ein anderes Gerät hat aufgelöst) und darf die Auflösung nicht zurücksetzen.
 *
 * Anforderung: @TM-027 (alle Geräte zeigen
 * dieselbe Besetzung).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Match, Tournament } from '../../models/types';
import { pendingSlot, teamSlot } from '../../models/matchSlot';
import { testUuid } from '../../../test/testIds';

vi.mock('../SupabaseRepository');
vi.mock('../LocalStorageRepository');

const NORD = testUuid(1);
const SUED = testUuid(2);
const HF1 = testUuid(100);

function tournament(match: Partial<Match>, version: number): Tournament {
  return {
    id: 't1',
    title: 'Hallencup',
    date: '2026-10-23',
    status: 'published',
    version,
    teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }],
    matches: [{ id: 'm1', round: 1, field: 1, teamA: NORD, teamB: SUED, ...match }],
    groups: [],
    fields: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  } as unknown as Tournament;
}

describe('OfflineRepository.syncUp – A-02: Spielseiten im Delta-Sync', () => {
  let offlineRepo: OfflineRepository;
  let mockSupabase: {
    get: ReturnType<typeof vi.fn>;
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
    mockSupabase.updateTournamentMetadata.mockResolvedValue(undefined);
    offlineRepo = new OfflineRepository(
      mockLocal as unknown as LocalStorageRepository,
      mockSupabase as unknown as SupabaseRepository
    );
  });

  it('Teamtausch erreicht die Cloud: lokaler Teamtausch (gleiche Spiel-ID) erzwingt ein Voll-Speichern', async () => {
    const local = tournament({ slotA: teamSlot(SUED), slotB: teamSlot(NORD) }, 2);
    const remote = tournament({ slotA: teamSlot(NORD), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
  });

  it('@TM-027 Gegenbeispiel: lokal offene Seite gegen Cloud-Besetzung löst KEIN Voll-Speichern aus', async () => {
    const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;
    const local = tournament({ slotA: pendingSlot(source), slotB: teamSlot(SUED) }, 2);
    const remote = tournament({ slotA: teamSlot(NORD, source), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });

  it('gleiche Besetzung (auch mit Herkunft auf einer Seite) ist keine Änderung', async () => {
    const source = { kind: 'groupRank', group: 'A', rank: 1 } as const;
    const local = tournament({ slotA: teamSlot(NORD, source), slotB: teamSlot(SUED) }, 2);
    const remote = tournament({ slotA: teamSlot(NORD, source), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });

  // A-03 (M4): Besetzung nur aus bestätigtem Server-Stand
  it('@TM-027 nur lokal aufgelöste Seite (resolvedFrom) gegen offene Cloud-Seite löst kein Voll-Speichern aus', async () => {
    const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;
    const local = tournament({ slotA: teamSlot(NORD, source), slotB: teamSlot(SUED) }, 2);
    const remote = tournament({ slotA: pendingSlot(source), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });

  it('@TM-027 Gegenbeispiel: direkt besetzte Seite (ohne resolvedFrom) gegen offene Cloud-Seite erzwingt weiter das Voll-Speichern', async () => {
    const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;
    const local = tournament({ slotA: teamSlot(NORD), slotB: teamSlot(SUED) }, 2);
    const remote = tournament({ slotA: pendingSlot(source), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).toHaveBeenCalledTimes(1);
  });

  it('@TM-027 lokal aufgelöst mit anderem Team als die Cloud-Auflösung: löst kein Voll-Speichern aus', async () => {
    const source = { kind: 'groupRank', group: 'A', rank: 1 } as const;
    const local = tournament({ slotA: teamSlot(NORD, source), slotB: teamSlot(SUED) }, 2);
    const remote = tournament({ slotA: teamSlot(SUED, source), slotB: teamSlot(SUED) }, 1);
    mockLocal.listForCurrentUser.mockResolvedValue([local]);
    mockSupabase.get.mockResolvedValue(remote);

    await offlineRepo.syncUp();

    expect(mockSupabase.save).not.toHaveBeenCalled();
  });
});
