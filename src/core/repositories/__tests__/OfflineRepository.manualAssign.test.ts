/**
 * A-04a (K6) – Ein manueller Tausch der Leitung erreicht die Cloud (Voll-Speichern), eine nur lokal
 * aufgelöste Seite nicht. Prüft `assignTeamToSide` gegen die echte Entscheidung in `OfflineRepository`.
 * Vorgabe K6, keine Szenario-Kennung.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import type { Match, Tournament } from '../../models/types';
import { pendingSlot, teamSlot } from '../../models/matchSlot';
import { assignTeamToSide } from '../../models/matchAssignment';
import { testUuid } from '../../../test/testIds';

vi.mock('../SupabaseRepository');
vi.mock('../LocalStorageRepository');

const NORD = testUuid(1);
const SUED = testUuid(2);
const UFER = testUuid(3);
const HF1 = testUuid(100);
const source = { kind: 'matchResult', matchId: HF1, role: 'winner' } as const;

function tournament(match: Match, version: number): Tournament {
  return {
    id: 't1', title: 'Hallencup', date: '2026-10-23', status: 'published', version,
    teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: UFER, name: 'VfB Ufer' }],
    matches: [match], groups: [], fields: [],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  } as unknown as Tournament;
}

describe('OfflineRepository.syncUp – K6: manuelles Umbesetzen', () => {
  let repo: OfflineRepository;
  let supabase: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; updateTournamentMetadata: ReturnType<typeof vi.fn> };
  let local: { listForCurrentUser: ReturnType<typeof vi.fn>; updateLocalVersion: ReturnType<typeof vi.fn> };

  // Heimseite lokal aus „Sieger HF1“ aufgelöst zu FC Nord; die Cloud kennt dieselbe Besetzung
  const resolvedMatch = {
    id: 'm1', round: 1, field: 1, teamA: NORD, teamB: SUED,
    slotA: teamSlot(NORD, source), slotB: teamSlot(SUED),
  } as Match;
  const cloudMatch = { ...resolvedMatch, slotA: teamSlot(NORD, source) } as Match;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = new SupabaseRepository() as unknown as typeof supabase;
    local = new LocalStorageRepository() as unknown as typeof local;
    local.updateLocalVersion.mockResolvedValue(undefined);
    supabase.save.mockResolvedValue(undefined);
    supabase.updateTournamentMetadata.mockResolvedValue(undefined);
    repo = new OfflineRepository(local as unknown as LocalStorageRepository, supabase as unknown as SupabaseRepository);
    supabase.get.mockResolvedValue(tournament({ ...cloudMatch, slotA: pendingSlot(source) }, 1));
  });

  afterEach(() => {
    repo.mutationQueue.dispose();
  });

  it('K6 Pflichttest K6: manuelles Umbesetzen der Heimseite geht per Voll-Speichern in die Cloud', async () => {
    local.listForCurrentUser.mockResolvedValue([tournament(assignTeamToSide(resolvedMatch, 'A', UFER), 2)]);
    await repo.syncUp();
    expect(supabase.save).toHaveBeenCalledTimes(1);
  });

  it('K6 Gegenbeispiel K6: ohne Umbesetzen bleibt die nur lokal aufgelöste Seite ohne Voll-Speichern', async () => {
    local.listForCurrentUser.mockResolvedValue([tournament(resolvedMatch, 2)]);
    await repo.syncUp();
    expect(supabase.save).not.toHaveBeenCalled();
  });

  it('K6 Gegenbeispiel K6: ein Tausch, der resolvedFrom behielte, ginge verloren (so darf assignTeamToSide nicht arbeiten)', async () => {
    const stale = { ...resolvedMatch, slotA: teamSlot(UFER, source) } as Match;
    local.listForCurrentUser.mockResolvedValue([tournament(stale, 2)]);
    await repo.syncUp();
    expect(supabase.save).not.toHaveBeenCalled();
  });
});
