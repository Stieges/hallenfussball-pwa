/**
 * guestMigrationService.M2.test.ts — C3b-2 Fixrunde F1, M2.
 *
 * task-C3b2-review.md M2: `getLocalTournamentsToMigrate` hatte einen leeren `catch` —
 * ein Lesefehler des Gast-Engine-Speichers ließ das Turnier einfach unter den Tisch
 * fallen, ohne Meldung. Fix: eine gemeinsame Klassifizierung (`classifyLocalCandidates`,
 * intern) zählt den Lesefehler als fehlgeschlagen (`failedCount`/`errors`, dieselbe
 * Quelle wie `migrateGuestTournaments`) und meldet ihn an Sentry via
 * `captureFeatureError` — erlaubt, weil diese Datei nicht unter `src/core/` liegt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../../../types/tournament';
import { LocalMatchStore } from '../../../../core/match/client/LocalMatchStore';

const hoisted = vi.hoisted(() => ({
  localList: [] as Tournament[],
  cloudList: [] as Tournament[],
  captureFeatureError: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('../../../../lib/sentry', () => ({
  captureFeatureError: hoisted.captureFeatureError,
}));

vi.mock('../../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.localList;
    }
    async delete(): Promise<void> {
      // nicht relevant fuer diesen Test
    }
  },
}));

vi.mock('../../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.cloudList;
    }
    async save(): Promise<void> {
      // nicht relevant fuer diesen Test
    }
  },
}));

import { migrateGuestTournaments, getLocalTournamentsToMigrate } from '../guestMigrationService';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('guestMigrationService — M2 (C3b-2 F1): Lesefehler zaehlt statt leerem catch', () => {
  beforeEach(() => {
    hoisted.localList = [];
    hoisted.cloudList = [];
    hoisted.captureFeatureError.mockClear();
  });

  it('getLocalTournamentsToMigrate: Lesefehler wird an Sentry gemeldet (captureFeatureError), Turnier fehlt in der Liste', async () => {
    hoisted.localList = [tournament('t-m2-broken', 'm2-broken-m1')];
    const readSpy = vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValueOnce(new Error('DB weg'));

    const toMigrate = await getLocalTournamentsToMigrate();

    expect(toMigrate).toEqual([]);
    expect(hoisted.captureFeatureError).toHaveBeenCalledTimes(1);
    expect(hoisted.captureFeatureError).toHaveBeenCalledWith(
      expect.any(Error),
      'guestMigration',
      'classifyLocalCandidates',
      expect.objectContaining({ tournamentId: 't-m2-broken' }),
    );
    readSpy.mockRestore();
  });

  it('migrateGuestTournaments und getLocalTournamentsToMigrate zaehlen denselben Lesefehler (eine Quelle)', async () => {
    hoisted.localList = [tournament('t-m2-shared-broken', 'm2-shared-broken-m1')];
    const readSpy = vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValueOnce(new Error('DB weg'));

    const result = await migrateGuestTournaments();

    expect(result.failedCount).toBe(1);
    expect(result.errors).toEqual([`"Turnier t-m2-shared-broken": DB weg`]);
    expect(hoisted.captureFeatureError).toHaveBeenCalledTimes(1);
    readSpy.mockRestore();
  });
});
