/**
 * R3-2a, Auflage Review #389 B6: Ein Turnier, das mit alten Schlüsseln in `config` (`manuallyCompleted`, `dashboardStatus`,
 * `statsSnapshot`) am Server abgeschlossen wurde, bekommt beim ersten „No-op“-Speichern danach eine Konfig-Änderung –
 * `mapTournamentToSupabase` baut `config` ohne diese Schlüssel neu. Der Server lehnt das mit 55000 TOURNAMENT_FINISHED ab
 * (`tournaments_guard_lifecycle`, 20261113_003: nach dem Abschluss ist in `config` nur `publicScorers` frei).
 *
 * Szenarien: @LZ-038 (der Server lehnt Änderungen nach dem Abschluss ab, der Endstand bleibt), @HE-070 Z. 1 (abgelehnt mit
 * „Turnier ist abgeschlossen“), @FU-126 (eindeutig → einmal, mit Grund, keine Schleife).
 * Gegenbeispiel: ohne alte Schlüssel geht dasselbe Speichern durch (die Sperre lässt ein No-op durch, Review B1/B2 zu #363).
 *
 * Echte Kette `MutationQueue` → `SupabaseRepository.save` → Mapper; nur der Supabase-Client ist gemockt. Die Sperre des
 * Servers ist so nachgebildet, wie `tournaments_guard_lifecycle` `config` vergleicht.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';
import { testUuid } from '../../../test/testIds';

type Row = Record<string, unknown>;

const hoisted = vi.hoisted(() => {
  const server = { config: {} as Record<string, unknown> };
  const sentConfigs: Record<string, unknown>[] = [];
  /** Wie `tournaments_guard_lifecycle` nach dem Abschluss: `config` ohne `publicScorers`/`standingDecisions` muss gleich bleiben. */
  const guard = (row: Row) => {
    const strip = (config: Record<string, unknown>) => {
      const { publicScorers: _p, standingDecisions: _s, ...rest } = config;
      return JSON.stringify(Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b))));
    };
    const sent = (row.config ?? {}) as Record<string, unknown>;
    sentConfigs.push(sent);
    return strip(sent) === strip(server.config)
      ? { data: [{ id: row.id }], error: null }
      : { data: null, error: { code: '55000', message: `TOURNAMENT_FINISHED: Turnier ist abgeschlossen (Turnier ${String(row.id)}).`, details: null, hint: null } };
  };
  const tournamentsUpdate = vi.fn((row: Row) => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve(guard(row)) }) }) }));
  const from = vi.fn((table: string) => {
    if (table === 'tournaments') {
      return { update: tournamentsUpdate, upsert: () => Promise.resolve({ error: null }) };
    }
    if (table === 'teams' || table === 'matches') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
      };
    }
    throw new Error(`unerwartete Tabelle im Test: ${table}`);
  });
  const supabase = { from, auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }) } };
  return { server, sentConfigs, tournamentsUpdate, supabase };
});

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return true; }),
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
    getIsAvailable: vi.fn(() => true),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: hoisted.supabase, isSupabaseConfigured: true }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

import { SupabaseRepository } from '../SupabaseRepository';
import { mapTournamentToSupabase } from '../supabaseMappers';
import { MutationQueue } from '../../services/MutationQueue';
import type { LocalStorageRepository } from '../LocalStorageRepository';

const ALTE_SCHLUESSEL = { manuallyCompleted: true, completedAt: '2026-11-14T18:05:00.000Z', dashboardStatus: 'finished', statsSnapshot: { goals: 41 } };

/** Live-Cup, aus der Cloud gelesen (Version 7), lokal unverändert seit dem Abschluss. */
function liveCup(): Tournament {
  return {
    id: testUuid(1), title: 'Live-Cup', date: '2026-11-14', location: { name: 'Sporthalle Ost' },
    version: 7, changeRevision: 3, lifecycleStatus: 'finished', teams: [], matches: [],
  } as unknown as Tournament;
}

const localRepo = {
  get: vi.fn(async () => liveCup()),
  confirmUpload: vi.fn(async () => undefined),
} as unknown as LocalStorageRepository;

let mq: MutationQueue | undefined;
let consoleError: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
  mockStorage.clear();
  hoisted.sentConfigs.length = 0;
  hoisted.tournamentsUpdate.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  mq?.dispose();
  vi.useRealTimers();
  consoleError?.mockRestore();
});

describe('R3-2a Auflage #389 B6: alte Schlüssel in config nach dem Abschluss → erstes Speichern löst 55000 aus', () => {
  it('@LZ-038 @HE-070 erstes Speichern nach dem Abschluss: einmal gesendet, „nicht übernommen – Turnier ist abgeschlossen“, keine Schleife', async () => {
    const neuGebaut = mapTournamentToSupabase(liveCup(), 'user-1').tournamentRow.config as Record<string, unknown>;
    hoisted.server.config = { ...neuGebaut, ...ALTE_SCHLUESSEL };
    mq = new MutationQueue(new SupabaseRepository(), localRepo);

    mq.enqueue('SAVE_TOURNAMENT', liveCup());
    await mq.process();
    await vi.advanceTimersByTimeAsync(600000);

    // der Mapper lässt die alten Schlüssel weg – genau das ist die Änderung, die der Server ablehnt
    expect(hoisted.sentConfigs[0]).not.toHaveProperty('manuallyCompleted');
    expect(hoisted.sentConfigs[0]).not.toHaveProperty('dashboardStatus');
    expect(hoisted.tournamentsUpdate).toHaveBeenCalledTimes(1);
    expect(mq.getPendingCount()).toBe(0);
    expect(mq.getFailedMutations().map((f) => ({ type: f.type, rejection: f.rejection, retryCount: f.retryCount }))).toEqual([
      { type: 'SAVE_TOURNAMENT', rejection: 'tournamentFinished', retryCount: 0 },
    ]);
  });

  it('Gegenbeispiel: ohne alte Schlüssel ist dasselbe Speichern ein No-op und geht durch', async () => {
    hoisted.server.config = { ...(mapTournamentToSupabase(liveCup(), 'user-1').tournamentRow.config as Record<string, unknown>) };
    mq = new MutationQueue(new SupabaseRepository(), localRepo);

    mq.enqueue('SAVE_TOURNAMENT', liveCup());
    await mq.process();
    await vi.advanceTimersByTimeAsync(10000);

    expect(hoisted.tournamentsUpdate).toHaveBeenCalledTimes(1);
    expect(mq.getPendingCount()).toBe(0);
    expect(mq.getFailedCount()).toBe(0);
  });
});
