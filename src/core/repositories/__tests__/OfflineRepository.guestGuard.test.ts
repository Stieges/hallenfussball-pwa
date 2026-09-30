/**
 * OfflineRepository.guestGuard.test.ts — C3b-2c (G7): Wache am syncUp-Weg.
 *
 * G7 (task-C3b-plan.md): Turniere mit Engine-Einträgen im Gastkonto werden über
 * `syncUp` NICHT hochgeladen — weder als Voll-Upload noch über den Delta-Weg
 * (`syncTournamentDelta`, der selbst `save`/`updateTournamentMetadata` aufruft).
 * Turniere ohne Einträge werden wie bisher hochgeladen.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineRepository } from '../OfflineRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import type { SupabaseRepository } from '../SupabaseRepository';
import type { Tournament } from '../../models/types';
import { LocalMatchStore } from '../../match/client/LocalMatchStore';
import { ctx, ev } from '../../match/client/__tests__/fixtures';

function tournament(id: string, version: number, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    version,
    teams: [],
    groups: [],
    fields: [],
    matches: matchIds.map((matchId) => ({ id: matchId })),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  } as unknown as Tournament;
}

interface RepoMocks {
  local: {
    listForCurrentUser: ReturnType<typeof vi.fn>;
    updateLocalVersion: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  cloud: {
    get: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    updateTournamentMetadata: ReturnType<typeof vi.fn>;
    updateMatches: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

function createRepo(): { repo: OfflineRepository; mocks: RepoMocks } {
  const mocks: RepoMocks = {
    local: {
      listForCurrentUser: vi.fn(async () => []),
      updateLocalVersion: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    },
    cloud: {
      get: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
      updateTournamentMetadata: vi.fn(async () => undefined),
      updateMatches: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
  };
  const repo = new OfflineRepository(
    mocks.local as unknown as LocalStorageRepository,
    mocks.cloud as unknown as SupabaseRepository,
  );
  return { repo, mocks };
}

describe('OfflineRepository.syncUp — G7-Wache (C3b-2c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Voll-Upload: Turnier mit Gast-Einträgen wird nicht hochgeladen', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'su-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'su-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    const { repo, mocks } = createRepo();
    mocks.local.listForCurrentUser.mockResolvedValue([tournament('t-guard', 1, 'su-guard-m1')]);
    mocks.cloud.get.mockResolvedValue(null);

    await repo.syncUp();

    expect(mocks.cloud.save).not.toHaveBeenCalled();
  });

  it('Voll-Upload: Turnier ohne Einträge wird wie bisher hochgeladen', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'su-free-m1', ctx);

    const { repo, mocks } = createRepo();
    mocks.local.listForCurrentUser.mockResolvedValue([tournament('t-free', 1, 'su-free-m1')]);
    mocks.cloud.get.mockResolvedValue(null);

    await repo.syncUp();

    expect(mocks.cloud.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-free' }));
  });

  it('Delta-Weg: Turnier mit Gast-Einträgen wird auch nicht per Delta gepusht', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'su-delta-g', ctx);
    await store.addConfirmedLocal('guest', 'su-delta-g', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    const { repo, mocks } = createRepo();
    const localT = tournament('t-delta', 2, 'su-delta-g');
    mocks.local.listForCurrentUser.mockResolvedValue([localT]);
    // Cloud-Kopie vorhanden (Version 1), lokal neuer (Version 2) -> Delta-Weg
    mocks.cloud.get.mockResolvedValue(tournament('t-delta', 1, 'su-delta-g'));

    await repo.syncUp();

    expect(mocks.cloud.save).not.toHaveBeenCalled();
    expect(mocks.cloud.updateTournamentMetadata).not.toHaveBeenCalled();
    expect(mocks.cloud.updateMatches).not.toHaveBeenCalled();
    expect(mocks.local.updateLocalVersion).not.toHaveBeenCalled();
  });
});