/**
 * A-36a (Brief Schritt 4, Plan-Review M3): Fehlercode HF002 „Herkunft eines Platzes ist unveränderlich“.
 *
 * Ein Schreiben, das die Herkunft des Platzes ändern will, scheitert in der Cloud laut (Trigger
 * `matches_keep_origin`). Der Fehler liegt im Stand, nicht im Netz: nicht transient. Die Warteschlange zählt
 * ihn als Fehlversuch und legt den Eintrag nach MAX_RETRIES im Dead-Letter ab – kein Endlos-Wiederholen,
 * und der Eintrag geht nicht verloren (@FU-019).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return true; }),
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
let qId = 0;
vi.mock('../../../utils/idGenerator', () => ({ generateUniqueId: vi.fn(() => `hf002-q-${++qId}`) }));

import { GenericMutationQueue, MAX_RETRIES, type GenericMutationItem } from '../GenericMutationQueue';
import {
  ORIGIN_IMMUTABLE_CODE,
  OriginImmutableError,
  RepositoryError,
  isOriginImmutableError,
  isTransientMutationError,
  toOriginImmutableError,
} from '../../errors';

type QType = 'UPDATE_MATCHES';
const nav = { onLine: true };

/** Offline einreihen (kein Sofort-Versand), dann online: jeder `process()` ist genau ein Versuch. */
function enqueueOffline(queue: GenericMutationQueue<QType>): void {
  nav.onLine = false;
  queue.enqueue('UPDATE_MATCHES', { tournamentId: 't1', updates: [{ id: 'm1' }] });
  nav.onLine = true;
}
let q: GenericMutationQueue<QType> | undefined;

/** Wie Postgrest den Trigger-Fehler liefert (Plain-Object mit `code`). */
const postgrestHf002 = { message: 'Herkunft eines Platzes ist unveraenderlich (Spiel m1, Seite A)', details: '', hint: '', code: 'HF002' };

/** Wie `SupabaseRepository.updateMatches` ihn weiterreicht: RepositoryError mit Error[]. */
function updateMatchesHf002(): RepositoryError {
  const perMatch = [toOriginImmutableError('m1', postgrestHf002) ?? new Error('fehlt')];
  return new RepositoryError('updateMatches', `Failed to update matches/tournament: ${perMatch[0].message}`, perMatch);
}

function makeQ(execute: (item: GenericMutationItem<QType>) => Promise<void>): GenericMutationQueue<QType> {
  return new GenericMutationQueue<QType>({
    storageKey: 'test_queue_hf002_v1',
    failedStorageKey: 'test_queue_hf002_failed_v1',
    execute,
    coalesceKey: () => null,
    sentryFeature: 'sync',
  });
}

beforeEach(() => {
  mockStorage.clear();
  qId = 0;
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
});

afterEach(() => {
  q?.dispose();
  q = undefined;
});

describe('A-36a HF002 ist nicht transient', () => {
  it('Fehlercode-Liste: HF002 = Herkunft unveränderlich', () => {
    expect(ORIGIN_IMMUTABLE_CODE).toBe('HF002');
  });

  it('@FU-019 Postgrest-Fehler mit code HF002 wird OriginImmutableError, nie transient', () => {
    const error = toOriginImmutableError('m1', postgrestHf002);
    expect(error).toBeInstanceOf(OriginImmutableError);
    expect(error?.matchId).toBe('m1');
    expect(isOriginImmutableError(postgrestHf002)).toBe(true);
    expect(isTransientMutationError(error)).toBe(false);
    expect(isTransientMutationError(updateMatchesHf002())).toBe(false);
  });

  it('Gegenbeispiel: ein anderer Fehlercode wird nicht zu OriginImmutableError', () => {
    expect(toOriginImmutableError('m1', { message: 'x', code: '23514' })).toBeUndefined();
    expect(toOriginImmutableError('m1', null)).toBeUndefined();
    expect(isOriginImmutableError({ code: '23514' })).toBe(false);
  });
});

describe('A-36a HF002 in der Warteschlange: Dead-Letter statt Endlos-Wiederholung', () => {
  // BP-1 (@FU-126, Befund C-ENDGUELTIG-SOFORT-MELDEN): HF002 ist eine eindeutige Ablehnung – sofort, ohne Wiederholung
  it('@FU-019 @FU-126 HF002 liegt nach dem ersten Versuch im Dead-Letter (Nutzlast erhalten, ungültiger Wert), kein weiterer Versuch', async () => {
    const execute = vi.fn().mockRejectedValue(updateMatchesHf002());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    enqueueOffline(q);

    for (let i = 0; i < MAX_RETRIES; i++) {
      await q.process();
    }

    expect(execute).toHaveBeenCalledTimes(1);
    expect(q.getFailedMutations()[0].rejection).toBe('invalidValue');
    expect(q.getPendingCount()).toBe(0);
    expect(q.getFailedCount()).toBe(1);
    expect(q.getFailedMutations()[0].payload).toEqual({ tournamentId: 't1', updates: [{ id: 'm1' }] });
    expect(q.getFailedMutations()[0].lastError).toMatch(/Herkunft/);
  });

  it('Gegenbeispiel: ein Netzfehler (transient) bleibt wartend und wird weiter wiederholt', async () => {
    const netError = new RepositoryError('updateMatches', 'TypeError: Failed to fetch', [new Error('Match m1: TypeError: Failed to fetch')]);
    const execute = vi.fn().mockRejectedValue(netError);
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    enqueueOffline(q);

    for (let i = 0; i < MAX_RETRIES + 2; i++) {
      await q.process();
    }

    expect(execute).toHaveBeenCalledTimes(MAX_RETRIES + 2);
    expect(q.getPendingCount()).toBe(1);
    expect(q.getFailedCount()).toBe(0);
  });
});
