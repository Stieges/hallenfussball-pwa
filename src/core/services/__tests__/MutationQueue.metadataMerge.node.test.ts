/**
 * BP-1 – Befund C-METADATEN-ZUSAMMENFASSEN-VERLIERT-FELDER, Szenario @FU-125.
 *
 * @FU-125: Ollis Gerät hat kein Netz. Olli ändert den Turniernamen auf „Live-Cup Ost“, danach den Ort auf „Sporthalle Süd“
 * und danach den Namen auf „Live-Cup Ost 2026“. Hat das Gerät wieder Netz, heißt das Turnier in der Cloud „Live-Cup Ost
 * 2026“ und spielt in der „Sporthalle Süd“ (die jüngere Änderung gewinnt je Angabe, keine geht verloren).
 * Gegenbeispiel: dieselbe Angabe zweimal – nur die jüngere kommt an, und es bleibt bei einem Eintrag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';

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
vi.mock('../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

import { MutationQueue } from '../MutationQueue';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';

const localRepo = { get: vi.fn(async () => null) } as unknown as LocalStorageRepository;

/** Cloud-Zeile: Name und Ort (Teilfelder des Orts einzeln, wie `updateTournamentMetadata`). */
function makeCloud() {
  const row = { title: 'Live-Cup', locationName: 'Sporthalle Nord', locationCity: 'Augsburg' };
  const repo = {
    updateTournamentMetadata: vi.fn(async (_id: string, metadata: Partial<Tournament>) => {
      if (metadata.title !== undefined) { row.title = metadata.title; }
      if (metadata.location?.name !== undefined) { row.locationName = metadata.location.name; }
      if (metadata.location?.city !== undefined) { row.locationCity = metadata.location.city; }
    }),
  };
  return { row, repo };
}

let mq: MutationQueue | undefined;

beforeEach(() => {
  mockStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
});

afterEach(() => {
  mq?.dispose();
  vi.useRealTimers();
});

const angaben = (metadata: Partial<Tournament>) => ({ tournamentId: 'live-cup', metadata });

describe('BP-1 C-METADATEN-ZUSAMMENFASSEN-VERLIERT-FELDER: Zusammenfassen verliert keine Angabe (@FU-125)', () => {
  it('@FU-125 Name, Ort, Name ohne Netz: Cloud heißt „Live-Cup Ost 2026“ und spielt in der „Sporthalle Süd“', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ title: 'Live-Cup Ost' }));
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ location: { name: 'Sporthalle Süd' } }));
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ title: 'Live-Cup Ost 2026' }));

    (globalThis.navigator as { onLine: boolean }).onLine = true;
    await mq.process();

    expect(cloud.row).toMatchObject({ title: 'Live-Cup Ost 2026', locationName: 'Sporthalle Süd' });
    expect(mq.getPendingCount()).toBe(0);
  });

  it('@FU-125 Teilfelder des Orts: Hallenname und danach Stadt – beide kommen an', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ location: { name: 'Sporthalle Süd' } }));
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ location: { city: 'München' } } as Partial<Tournament>));

    (globalThis.navigator as { onLine: boolean }).onLine = true;
    await mq.process();

    expect(cloud.row).toMatchObject({ locationName: 'Sporthalle Süd', locationCity: 'München' });
  });

  it('@FU-125 Gegenbeispiel: zweimal der Name – ein Eintrag, nur der jüngere Name kommt an', async () => {
    const cloud = makeCloud();
    mq = new MutationQueue(cloud.repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ title: 'Live-Cup Ost' }));
    mq.enqueue('UPDATE_TOURNAMENT_METADATA', angaben({ title: 'Live-Cup Ost 2026' }));
    expect(mq.getPendingCount()).toBe(1);

    (globalThis.navigator as { onLine: boolean }).onLine = true;
    await mq.process();

    expect(cloud.repo.updateTournamentMetadata).toHaveBeenCalledTimes(1);
    expect(cloud.row.title).toBe('Live-Cup Ost 2026');
  });
});
