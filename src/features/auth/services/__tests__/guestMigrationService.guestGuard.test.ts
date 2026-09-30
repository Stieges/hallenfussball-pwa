/**
 * guestMigrationService.guestGuard.test.ts — C3b-2c (G7): Wache am Migrations-Weg.
 *
 * G7 (task-C3b-plan.md): Ein Turnier mit Engine-Einträgen im Gastkonto darf bei der
 * Anmeldung NICHT hochgeladen werden — auch nicht über `guestMigrationService` — und
 * danach nicht aus dem lokalen Speicher gelöscht werden (sonst wären die Ergebnisse
 * nach dem Abmelden weg). Turniere OHNE Einträge migrieren wie bisher.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../../../types/tournament';
import { LocalMatchStore } from '../../../../core/match/client/LocalMatchStore';
import { ctx, ev } from '../../../../core/match/client/__tests__/fixtures';

const hoisted = vi.hoisted(() => ({
  localList: [] as Tournament[],
  localDeleted: [] as string[],
  cloudSaved: [] as Tournament[],
  cloudList: [] as Tournament[],
}));

vi.mock('../../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('../../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.localList;
    }
    async delete(id: string): Promise<void> {
      hoisted.localDeleted.push(id);
    }
  },
}));

vi.mock('../../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: class {
    async listForCurrentUser(): Promise<Tournament[]> {
      return hoisted.cloudList;
    }
    async save(tournament: Tournament): Promise<void> {
      hoisted.cloudSaved.push(tournament);
    }
  },
}));

import {
  migrateGuestTournaments,
  getLocalTournamentsToMigrate,
} from '../guestMigrationService';

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('guestMigrationService — G7-Wache (C3b-2c)', () => {
  beforeEach(() => {
    hoisted.localList = [];
    hoisted.localDeleted = [];
    hoisted.cloudSaved = [];
    hoisted.cloudList = [];
  });

  it('überspringt ein Turnier mit Gast-Einträgen: kein save, kein delete', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mig-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'mig-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.localList = [tournament('t-guard', 'mig-guard-m1')];

    const result = await migrateGuestTournaments();

    expect(hoisted.cloudSaved).toEqual([]);
    expect(hoisted.localDeleted).toEqual([]);
    expect(result.migratedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('migriert ein Turnier ohne Einträge wie bisher (save + delete)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mig-free-m1', ctx);
    hoisted.localList = [tournament('t-free', 'mig-free-m1')];

    const result = await migrateGuestTournaments();

    expect(hoisted.cloudSaved.map((t) => t.id)).toEqual(['t-free']);
    expect(hoisted.localDeleted).toEqual(['t-free']);
    expect(result.migratedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('mischt korrekt: Gast-Turnier übersprungen, normales Turnier migriert', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mig-mix-g', ctx);
    await store.addConfirmedLocal('guest', 'mig-mix-g', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.localList = [tournament('t-mix-guard', 'mig-mix-g'), tournament('t-mix-free', 'mig-mix-f')];

    const result = await migrateGuestTournaments();

    expect(hoisted.cloudSaved.map((t) => t.id)).toEqual(['t-mix-free']);
    expect(hoisted.localDeleted).toEqual(['t-mix-free']);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedTitles).toEqual(['Turnier t-mix-guard']);
    expect(result.migratedCount).toBe(1);
  });

  it('getLocalTournamentsToMigrate führt Gast-Turniere mit Einträgen nicht auf (Counts)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mig-cnt-g', ctx);
    await store.addConfirmedLocal('guest', 'mig-cnt-g', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
    hoisted.localList = [tournament('t-cnt-guard', 'mig-cnt-g'), tournament('t-cnt-free', 'mig-cnt-f')];

    const toMigrate = await getLocalTournamentsToMigrate();

    expect(toMigrate.map((t) => t.id)).toEqual(['t-cnt-free']);
  });
});