/**
 * BP-1 – Befund C-ENDGUELTIG-SOFORT-MELDEN (Daniel 2026-10-10), Szenarien @FU-126 (Grundriss) und @FU-127 (Gegenbeispiel).
 *
 * @FU-126: Lehnt der Server eine Änderung eindeutig ab (<Grund>: Maria hat inzwischen geändert | ein Wert ist nicht
 * zulässig), zeigt Ollis Gerät spätestens 10 Sekunden später „nicht übernommen“ mit Grund, versucht diese Änderung nicht
 * noch einmal von selbst, und die übrigen wartenden Einträge gehen weiter raus.
 * @FU-127: Ein unklarer Fehler wird wiederholt; nimmt der Server die Änderung danach an, war sie nie „nicht übernommen“.
 *
 * Abgrenzung „eindeutig“ (Controller 2026-10-22, F2): Versionskonflikt, Postgres-Klasse 22/23, HF002/HF003, Team noch
 * referenziert. 42501 (Rechte) bleibt unklar.
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
import { OptimisticLockError, RepositoryError, TeamStillReferencedError } from '../../errors';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';

const localRepo = { get: vi.fn(async () => null), confirmUpload: vi.fn(async () => undefined) } as unknown as LocalStorageRepository;

function tour(id: string, title: string): Tournament {
  return { id, title, version: 3, matches: [], teams: [] } as unknown as Tournament;
}

function makeRepo(saveImpl: (t: Tournament) => Promise<number>) {
  return {
    save: vi.fn(saveImpl),
    updateMatch: vi.fn(async () => undefined),
    updateMatches: vi.fn(async () => undefined),
    updateTournamentMetadata: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
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

function setOnline(value: boolean): void {
  (globalThis.navigator as { onLine: boolean }).onLine = value;
}

/** Postgres-Fehler, wie `SupabaseRepository` ihn einpackt. */
const pgError = (code: string, message: string) => new RepositoryError('save', message, { code, message, details: null, hint: null });

const EINDEUTIG: ReadonlyArray<{ grund: string; error: () => unknown; conflict: boolean; rejection?: string }> = [
  { grund: 'Maria das Turnier inzwischen geändert hat', error: () => new OptimisticLockError('Turnier wurde zwischenzeitlich verändert. Bitte neu laden.'), conflict: true },
  { grund: 'ein Wert nicht zulässig ist (23505, doppelter Teamname)', error: () => pgError('23505', 'duplicate key value violates unique constraint "teams_tournament_id_name_key"'), conflict: false, rejection: 'invalidValue' },
  { grund: 'ein Wert nicht zulässig ist (22P02, ungültige Eingabe)', error: () => pgError('22P02', 'invalid input syntax for type uuid'), conflict: false, rejection: 'invalidValue' },
  { grund: 'ein Wert nicht zulässig ist (23514, Prüfregel)', error: () => pgError('23514', 'new row violates check constraint'), conflict: false, rejection: 'invalidValue' },
  { grund: 'ein Wert nicht zulässig ist (HF002, Herkunft unveränderlich)', error: () => pgError('HF002', 'origin is immutable'), conflict: false, rejection: 'invalidValue' },
  { grund: 'ein Wert nicht zulässig ist (HF003, Farben nur beim Anpfiff)', error: () => pgError('HF003', 'kit columns are server-only'), conflict: false, rejection: 'invalidValue' },
  { grund: 'ein Wert nicht zulässig ist (Team noch referenziert)', error: () => new TeamStillReferencedError('m7'), conflict: false, rejection: 'invalidValue' },
];

describe('BP-1 C-ENDGUELTIG-SOFORT-MELDEN: eindeutige Ablehnung sofort melden (@FU-126)', () => {
  it.each(EINDEUTIG)('@FU-126 Server lehnt ab, weil $grund: beim ersten Versuch „nicht übernommen“ mit Grund, kein neuer Versuch, Rest geht weiter', async ({ error, conflict, rejection }) => {
    const repo = makeRepo(async (t) => { if (t.title === 'abgelehnt') { throw error(); } return 4; });
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('SAVE_TOURNAMENT', tour('live-cup', 'abgelehnt'));
    mq.enqueue('UPDATE_MATCH', { tournamentId: 'anderer-cup', update: { id: 'm5' } });
    setOnline(true);

    await mq.process();
    await vi.advanceTimersByTimeAsync(10000);

    // spätestens 10 s: „nicht übernommen“ mit Grund
    expect(mq.getFailedCount()).toBe(1);
    const [failed] = mq.getFailedMutations();
    expect(failed.retryCount).toBe(0);
    expect(failed.conflict === true).toBe(conflict);
    expect(failed.rejection).toBe(rejection);
    // die übrigen Einträge gehen weiter raus
    expect(repo.updateMatch).toHaveBeenCalledTimes(1);
    expect(mq.getPendingCount()).toBe(0);
    // kein neuer Versuch von selbst – auch nach 10 Minuten nicht
    await vi.advanceTimersByTimeAsync(600000);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(mq.getFailedCount()).toBe(1);
  });
});

describe('BP-1 C-ENDGUELTIG-SOFORT-MELDEN: unklarer Fehler wird wiederholt (@FU-127)', () => {
  it.each([
    { art: 'unbekannter Serverfehler', error: () => new RepositoryError('save', 'Something went wrong', { code: 'XX000', message: 'internal' }) },
    { art: '42501 (Rechte, bleibt unklar)', error: () => pgError('42501', 'new row violates row-level security policy') },
    { art: 'Fehler ohne Code', error: () => new Error('unerwartet') },
  ])('@FU-127 $art beim ersten Versuch, danach angenommen: kommt an, nie „nicht übernommen“', async ({ error }) => {
    let first = true;
    const repo = makeRepo(async () => { if (first) { first = false; throw error(); } return 4; });
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('SAVE_TOURNAMENT', tour('live-cup', 'Live-Cup Ost'));
    setOnline(true);

    await mq.process();
    expect(mq.getFailedCount()).toBe(0);
    expect(mq.getPendingCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(30000);
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(mq.getPendingCount()).toBe(0);
    expect(mq.getFailedCount()).toBe(0);
  });
});
