/**
 * OfflineRepository.guestGuard.test.ts — C3b-2c (G7): Wachen an den OfflineRepository-Wegen.
 *
 * G7 (task-C3b-plan.md): Turniere mit Engine-Einträgen im Gastkonto werden über
 * `syncUp` NICHT hochgeladen — weder als Voll-Upload noch über den Delta-Weg
 * (`syncTournamentDelta`). Auch `resolveConflict('local')` und der Push-Teil von
 * `syncTournament` bleiben ohne Upload. Turniere ohne Einträge laufen wie bisher.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    get: ReturnType<typeof vi.fn>;
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
      get: vi.fn(async () => null),
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

describe('OfflineRepository.resolveConflict/syncTournament — G7-Wache (C3b-2c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveConflict(local): Turnier mit Gast-Einträgen wird nicht gepusht', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'rc-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'rc-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-rc', 1, 'rc-guard-m1'));

    const result = await repo.resolveConflict('t-rc', 'local');

    expect(mocks.cloud.save).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('resolveConflict(local): Turnier ohne Einträge wird wie bisher gepusht', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'rc-free-m1', ctx);

    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-rc-free', 1, 'rc-free-m1'));

    const result = await repo.resolveConflict('t-rc-free', 'local');

    expect(mocks.cloud.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-rc-free' }));
    expect(result.status).toBe('synced');
  });

  it('syncTournament: Turnier mit Gast-Einträgen wird nicht gepusht', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'st-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'st-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-st', 1, 'st-guard-m1'));
    mocks.cloud.get.mockResolvedValue(null);

    const result = await repo.syncTournament('t-st');

    expect(mocks.cloud.save).not.toHaveBeenCalled();
    expect(result.status).toBe('synced');
  });

  it('syncTournament: Turnier ohne Einträge wird wie bisher gepusht', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'st-free-m1', ctx);

    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-st-free', 1, 'st-free-m1'));
    mocks.cloud.get.mockResolvedValue(null);

    await repo.syncTournament('t-st-free');

    expect(mocks.cloud.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-st-free' }));
  });
});

describe('OfflineRepository — Lesefehler des lokalen Speichers (PC29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncUp: Lesefehler → dieses Turnier nicht hochladen, nächstes Turnier läuft weiter', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'rd-su-free-m1', ctx);
    const { repo, mocks } = createRepo();
    mocks.local.listForCurrentUser.mockResolvedValue([
      tournament('t-rd-broken', 1, 'rd-su-broken-m1'),
      tournament('t-rd-free', 1, 'rd-su-free-m1'),
    ]);
    mocks.cloud.get.mockResolvedValue(null);
    vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValueOnce(new Error('DB weg'));

    await repo.syncUp();

    expect(mocks.cloud.save).toHaveBeenCalledTimes(1);
    expect(mocks.cloud.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-rd-free' }));
  });

  it('resolveConflict(local): Lesefehler → kein Push, Ergebnis error', async () => {
    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-rd-rc', 1, 'rd-rc-m1'));
    vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValue(new Error('DB weg'));

    const result = await repo.resolveConflict('t-rd-rc', 'local');

    expect(mocks.cloud.save).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('syncTournament: Lesefehler → kein Push (Pull-Ergebnis bleibt)', async () => {
    const { repo, mocks } = createRepo();
    mocks.local.get.mockResolvedValue(tournament('t-rd-st', 1, 'rd-st-m1'));
    mocks.cloud.get.mockResolvedValue(null);
    vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValue(new Error('DB weg'));

    await repo.syncTournament('t-rd-st');

    expect(mocks.cloud.save).not.toHaveBeenCalled();
  });
});
