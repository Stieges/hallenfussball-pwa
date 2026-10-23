/**
 * BP-1 – Befund C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN, Szenarien @FU-123 (Grundriss) und @FU-124 (Gegenbeispiel).
 *
 * @FU-123: Der „Wintercup“ war in der Cloud; auf <Gerät> (Ollis Laptop | Marias Tablet) wartet ohne Netz eine Änderung der
 * Spielzeit; Olli hat ihn inzwischen auf einem anderen Gerät endgültig gelöscht. Hat das Gerät wieder Netz, gibt es den
 * Wintercup in der Cloud nicht wieder, das Gerät zeigt „nicht übernommen – Turnier gibt es nicht mehr“, und die übrigen
 * wartenden Einträge anderer Turniere gehen weiter raus.
 * @FU-124: Ein neues Turnier, das noch nie in der Cloud war, wird bei der ersten Übertragung angelegt.
 *
 * Hier: die Warteschlange sagt `save()`, ob das Gerät das Turnier aus der Cloud kennt (`mustExist`), und legt die
 * Ablehnung sofort ab. Dass `save()` mit `mustExist` nichts anlegt: `SupabaseRepository.save.test.ts`.
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
import { TournamentGoneError } from '../../errors';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';

/** Turnier mit 12 Minuten Spielzeit; `cloud`: Merkmale einer aus der Cloud übernommenen bzw. hochgeladenen Kopie. */
function wintercup(cloud: 'gelesen' | 'hochgeladen' | 'nie'): Tournament {
  const markers = cloud === 'gelesen' ? { changeRevision: 2 } : cloud === 'hochgeladen' ? { ownUploadsFrom: 1, serverVersion: 2 } : {};
  return { id: 'wintercup', title: 'Wintercup', version: 2, groupPhaseGameDuration: 12, matches: [], teams: [], ...markers } as unknown as Tournament;
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

function setup(local: Tournament | null, saveImpl: () => Promise<number>) {
  const repo = {
    save: vi.fn(saveImpl),
    updateMatch: vi.fn(async () => undefined),
  };
  const localRepo = { get: vi.fn(async () => local), confirmUpload: vi.fn(async () => undefined) } as unknown as LocalStorageRepository;
  mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
  return { repo, queue: mq };
}

describe('BP-1 C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN: alte wartende Änderung legt ein gelöschtes Turnier nicht neu an (@FU-123)', () => {
  it.each([
    { geraet: 'Ollis Laptop', kopie: 'hochgeladen' as const },
    { geraet: 'Marias Tablet', kopie: 'gelesen' as const },
  ])('@FU-123 $geraet: Speichern verlangt ein vorhandenes Turnier, „nicht übernommen – Turnier gibt es nicht mehr“, Rest geht weiter', async ({ kopie }) => {
    const { repo, queue } = setup(wintercup(kopie), async () => { throw new TournamentGoneError('wintercup'); });
    queue.enqueue('SAVE_TOURNAMENT', wintercup(kopie));
    queue.enqueue('UPDATE_MATCH', { tournamentId: 'anderer-cup', update: { id: 'm1' } });
    (globalThis.navigator as { onLine: boolean }).onLine = true;

    await queue.process();

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'wintercup' }), { mustExist: true });
    const [failed] = queue.getFailedMutations();
    expect(failed.rejection).toBe('tournamentGone');
    expect(failed.retryCount).toBe(0);
    expect(repo.updateMatch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600000);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('@FU-123 das Merkmal der lokalen Kopie zählt auch, wenn die eingereihte Nutzlast es nicht trägt', async () => {
    const { repo, queue } = setup(wintercup('hochgeladen'), async () => 3);
    queue.enqueue('SAVE_TOURNAMENT', wintercup('nie'));
    (globalThis.navigator as { onLine: boolean }).onLine = true;

    await queue.process();

    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'wintercup' }), { mustExist: true });
  });
});

describe('BP-1 C-WARTESCHLANGE-LEGT-GELOESCHTES-NEU-AN: Erstanlage bleibt möglich (@FU-124)', () => {
  it('@FU-124 noch nie in der Cloud (ohne Netz angelegt, zweimal gespeichert): Speichern darf anlegen', async () => {
    const { repo, queue } = setup(wintercup('nie'), async () => 1);
    queue.enqueue('SAVE_TOURNAMENT', wintercup('nie'));
    (globalThis.navigator as { onLine: boolean }).onLine = true;

    await queue.process();

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0]).toEqual([expect.objectContaining({ id: 'wintercup' })]); // ohne mustExist: darf anlegen
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
  });
});
