/**
 * BP-1 Review A3 – Befund C-ENDGUELTIG-SOFORT-MELDEN, Szenarien @FU-004 („der Eintrag bleibt erhalten, bis er übertragen oder
 * geklärt ist“) und @FU-126 (Grund der eindeutigen Ablehnung).
 *
 * Ein „nicht übernommen“-Eintrag, den eine NEUERE App-Version mit einem hier unbekannten Grund abgelegt hat (z. B. später
 * A-21a-C1: Turnier abgeschlossen), darf beim Laden durch eine ältere Version nicht still verschwinden. Er bleibt erhalten
 * und gilt hier als „unklar“ (kein eigener Grund: letzter Fehler und „Erneut versuchen“). Bekannte Gründe bleiben.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const FAILED_KEY = 'mutation_queue_failed_v1';

function abgelegt(id: string, rejection: string) {
  return {
    id,
    type: 'UPDATE_TOURNAMENT_METADATA',
    payload: { tournamentId: 'live-cup', metadata: { title: 'Live-Cup Ost' } },
    timestamp: 1,
    retryCount: 0,
    failedAt: 2,
    lastError: 'Grund aus einer neueren App-Version',
    rejection,
  };
}

let mq: MutationQueue | undefined;

beforeEach(() => {
  mockStorage.clear();
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
});

afterEach(() => {
  mq?.dispose();
});

describe('BP-1 Review A3 C-ENDGUELTIG-SOFORT-MELDEN: unbekannter Grund aus einer neueren App-Version (@FU-004, @FU-126)', () => {
  it('@FU-004 @FU-126 unbekannter Grund: Eintrag bleibt „nicht übernommen“ erhalten, gilt als unklar, auch nach erneutem Ablegen', async () => {
    // R3-2a: 'tournamentFinished' ist seitdem bekannt – als unbekannter Grund dient ein erfundener Wert
    mockStorage.set(FAILED_KEY, JSON.stringify([abgelegt('neu-1', 'grundAusNeuererVersion')]));

    mq = new MutationQueue({} as SupabaseRepository);

    expect(mq.getFailedCount()).toBe(1);
    const [item] = mq.getFailedMutations();
    expect(item.payload).toEqual({ tournamentId: 'live-cup', metadata: { title: 'Live-Cup Ost' } });
    expect(item.rejection).toBeUndefined(); // unklar: letzter Fehler, „Erneut versuchen“ bleibt

    // ein späteres Ablegen der Liste verliert ihn nicht
    mq.clearFailedMutation('gibt-es-nicht');
    mq.dispose();
    mq = new MutationQueue({} as SupabaseRepository);
    expect(mq.getFailedMutations().map((f) => f.id)).toEqual(['neu-1']);
  });

  it('@FU-126 Gegenbeispiel: ein bekannter Grund bleibt erhalten', async () => {
    mockStorage.set(FAILED_KEY, JSON.stringify([abgelegt('alt-1', 'tournamentGone')]));

    mq = new MutationQueue({} as SupabaseRepository);

    expect(mq.getFailedMutations().map((f) => f.rejection)).toEqual(['tournamentGone']);
  });
});
