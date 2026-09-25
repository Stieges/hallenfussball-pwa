import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenericMutationQueue, MAX_RETRIES } from '../GenericMutationQueue';
import type { GenericMutationItem, FailedMutationItem } from '../GenericMutationQueue';
import { RepositoryError } from '../../errors';

// =============================================================================
// Mocks (mirrored from MutationQueue.test.ts — same infra, generic payloads)
// =============================================================================

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  },
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

let idCounter = 0;
vi.mock('../../../utils/idGenerator', () => ({
  generateUniqueId: vi.fn(() => `mock-id-${++idCounter}`),
}));

type TestType = 'SAVE_THING' | 'DELETE_THING';

let onlineSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockStorage.clear();
  idCounter = 0;
  onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

function makeQueue(opts?: {
  execute?: ReturnType<typeof vi.fn>;
  online?: boolean;
  storageKey?: string;
  failedStorageKey?: string;
  isKnownType?: (type: string) => boolean;
}) {
  if (opts?.online === false) {
    onlineSpy.mockReturnValue(false);
  }
  const execute = opts?.execute ?? vi.fn().mockResolvedValue(undefined);
  const queue = new GenericMutationQueue<TestType>({
    storageKey: opts?.storageKey ?? 'test_queue_v1',
    failedStorageKey: opts?.failedStorageKey ?? 'test_queue_failed_v1',
    execute: execute as unknown as (item: GenericMutationItem<TestType>) => Promise<void>,
    coalesceKey: (type, p) =>
      type === 'SAVE_THING' && (p as { id?: string })?.id ? `SAVE:${(p as { id: string }).id}` : null,
    sentryFeature: 'sync',
    ...(opts?.isKnownType ? { isKnownType: opts.isKnownType } : {}),
  });
  return { queue, execute };
}

// =============================================================================
// Happy path
// =============================================================================

describe('GenericMutationQueue', () => {
  it('verarbeitet enqueued Items über den injizierten Executor', async () => {
    const { queue, execute } = makeQueue({ online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('coalesced Items mit gleichem Schlüssel', () => {
    const { queue } = makeQueue({ online: false });
    queue.enqueue('SAVE_THING', { id: 'a', v: 1 });
    queue.enqueue('SAVE_THING', { id: 'a', v: 2 });

    expect(queue.getPendingCount()).toBe(1);
  });

  it('zwei Instanzen mit verschiedenen Keys teilen keinen State', () => {
    const { queue: q1 } = makeQueue({ online: false });
    const { queue: q2 } = makeQueue({
      online: false,
      storageKey: 'other_queue_v1',
      failedStorageKey: 'other_failed_v1',
    });

    q1.enqueue('SAVE_THING', { id: 'a' });
    expect(q2.getPendingCount()).toBe(0);
  });

  // ===========================================================================
  // isKnownType (load-time guard — Task-3-Review Finding 1)
  // ===========================================================================

  it('lehnt Items mit unbekanntem Type beim Laden ab, wenn isKnownType konfiguriert ist', () => {
    const preload: GenericMutationItem<TestType>[] = [
      // Cast needed: simulating a corrupted/legacy item outside the known TestType union.
      { id: 'poisoned', type: 'UNKNOWN_TYPE' as TestType, payload: {}, timestamp: 1000, retryCount: 0 },
    ];
    mockStorage.set('test_queue_v1', JSON.stringify(preload));

    const { queue } = makeQueue({
      online: false,
      isKnownType: (type) => type === 'SAVE_THING' || type === 'DELETE_THING',
    });

    expect(queue.getPendingCount()).toBe(0);
  });

  it('lädt Items mit unbekanntem Type unverändert, wenn kein isKnownType konfiguriert ist', () => {
    const preload: GenericMutationItem<TestType>[] = [
      { id: 'unchecked', type: 'UNKNOWN_TYPE' as TestType, payload: {}, timestamp: 1000, retryCount: 0 },
    ];
    mockStorage.set('test_queue_v1', JSON.stringify(preload));

    const { queue } = makeQueue({ online: false });

    expect(queue.getPendingCount()).toBe(1);
  });

  it('lehnt Failed-Queue-Items mit unbekanntem Type beim Laden ab, wenn isKnownType konfiguriert ist', () => {
    const preloadFailed: FailedMutationItem<TestType>[] = [
      { id: 'poisoned-f', type: 'UNKNOWN_TYPE' as TestType, payload: {}, timestamp: 1000, retryCount: MAX_RETRIES, failedAt: 2000 },
    ];
    mockStorage.set('test_queue_failed_v1', JSON.stringify(preloadFailed));

    const { queue } = makeQueue({
      online: false,
      isKnownType: (type) => type === 'SAVE_THING' || type === 'DELETE_THING',
    });

    expect(queue.getFailedCount()).toBe(0);
  });

  it('lässt bekannte Types beim Laden unverändert durch isKnownType passieren', () => {
    const preload: GenericMutationItem<TestType>[] = [
      { id: 'ok', type: 'SAVE_THING', payload: { id: 'a' }, timestamp: 1000, retryCount: 0 },
    ];
    mockStorage.set('test_queue_v1', JSON.stringify(preload));

    const { queue } = makeQueue({
      online: false,
      isKnownType: (type) => type === 'SAVE_THING' || type === 'DELETE_THING',
    });

    expect(queue.getPendingCount()).toBe(1);
  });

  // ===========================================================================
  // Retry / Dead-letter (patterns adapted from MutationQueue.test.ts)
  // ===========================================================================

  it('erhöht retryCount bei Fehler und stoppt Verarbeitung', async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error('network'));
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(queue.getPendingCount()).toBe(1);
    const stored = JSON.parse(mockStorage.get('test_queue_v1') ?? '[]') as GenericMutationItem<TestType>[];
    expect(stored[0].retryCount).toBe(1);
  });

  it('verschiebt Item nach MAX_RETRIES Fehlversuchen ins Dead-Letter', async () => {
    const preload: GenericMutationItem<TestType>[] = [
      { id: 'item-1', type: 'SAVE_THING', payload: { id: 'a' }, timestamp: 1000, retryCount: MAX_RETRIES - 1 },
    ];
    mockStorage.set('test_queue_v1', JSON.stringify(preload));

    const execute = vi.fn().mockRejectedValueOnce(new Error('permanent'));
    const { queue } = makeQueue({ execute, online: false });

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(1);
    const failed = queue.getFailedMutations();
    expect(failed[0].lastError).toBe('permanent');
  });

  it('retryFailedMutation legt Item zurück in die Queue', () => {
    const failedItem: FailedMutationItem<TestType> = {
      id: 'f1',
      type: 'SAVE_THING',
      payload: { id: 'a' },
      timestamp: 1000,
      retryCount: MAX_RETRIES,
      failedAt: 2000,
      lastError: 'test error',
    };
    mockStorage.set('test_queue_failed_v1', JSON.stringify([failedItem]));

    const { queue } = makeQueue({ online: false });
    const result = queue.retryFailedMutation('f1');

    expect(result).toBe(true);
    expect(queue.getFailedCount()).toBe(0);
    expect(queue.getPendingCount()).toBe(1);
  });

  it('retryFailedMutation gibt false für unbekannte id zurück', () => {
    const { queue } = makeQueue({ online: false });
    expect(queue.retryFailedMutation('unknown')).toBe(false);
  });

  it('clearAllFailed entfernt alle fehlgeschlagenen Mutationen', () => {
    const failedItems: FailedMutationItem<TestType>[] = [
      { id: 'f1', type: 'SAVE_THING', payload: { id: 'a' }, timestamp: 1000, retryCount: MAX_RETRIES, failedAt: 2000 },
      { id: 'f2', type: 'DELETE_THING', payload: 'b', timestamp: 1000, retryCount: MAX_RETRIES, failedAt: 2000 },
    ];
    mockStorage.set('test_queue_failed_v1', JSON.stringify(failedItems));

    const { queue } = makeQueue({ online: false });
    const count = queue.clearAllFailed();

    expect(count).toBe(2);
    expect(queue.getFailedCount()).toBe(0);
  });

  // ===========================================================================
  // subscribe
  // ===========================================================================

  it('subscribe benachrichtigt Listener bei enqueue', () => {
    const { queue } = makeQueue({ online: false });
    const listener = vi.fn();
    queue.subscribe(listener);

    queue.enqueue('SAVE_THING', { id: 'a' });
    expect(listener).toHaveBeenCalledWith({ pendingCount: 1, failedCount: 0 });
  });

  it('unsubscribe stoppt Benachrichtigungen', () => {
    const { queue } = makeQueue({ online: false });
    const listener = vi.fn();
    const unsub = queue.subscribe(listener);
    unsub();

    queue.enqueue('SAVE_THING', { id: 'a' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('getStatus liefert aktuelle Zaehler', () => {
    const { queue } = makeQueue({ online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });
    queue.enqueue('DELETE_THING', 'b');

    const status = queue.getStatus();
    expect(status.pendingCount).toBe(2);
    expect(status.failedCount).toBe(0);
  });

  // ===========================================================================
  // Task A3: Netzfehler (kein echtes Internet trotz navigator.onLine) zählt
  // nicht als Fehlversuch — Eintrag bleibt wartend statt in der Fehlerliste.
  // ===========================================================================

  it('Netzfehler (Failed to fetch) zählt auch nach 20 Anstößen nicht als Fehlversuch', async () => {
    const execute = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    for (let i = 0; i < 20; i++) {
      await queue.process();
    }

    expect(execute).toHaveBeenCalledTimes(20);
    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getFailedCount()).toBe(0);
    const stored = JSON.parse(mockStorage.get('test_queue_v1') ?? '[]') as GenericMutationItem<TestType>[];
    expect(stored[0].retryCount).toBe(0);
  });

  it('RLS-Fehler (dauerhaft) landet wie bisher nach 5 Anstößen in der Fehlerliste', async () => {
    const rlsError = Object.assign(new Error('new row violates row-level security policy'), {
      code: '42501',
    });
    const execute = vi.fn().mockRejectedValue(rlsError);
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    for (let i = 0; i < MAX_RETRIES; i++) {
      await queue.process();
    }

    expect(execute).toHaveBeenCalledTimes(MAX_RETRIES);
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(1);
  });

  it('HTTP 5xx zählt nicht als Fehlversuch — Eintrag bleibt wartend', async () => {
    const serverError = Object.assign(new Error('Service Unavailable'), { status: 503 });
    const execute = vi.fn().mockRejectedValue(serverError);
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    for (let i = 0; i < 5; i++) {
      await queue.process();
    }

    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('Safari-Netzfehler ("Load failed") über die reale SupabaseRepository-Wrapping-Form zählt nicht als Fehlversuch', async () => {
    // Nachgebaut wie SupabaseRepository.updateMatches ihn tatsächlich wirft
    // (task-A3-review.md, Critical #1): postgrest-js liefert bei
    // fehlgeschlagenem fetch() (kein .throwOnError()) ein Plain-Object OHNE
    // .name-Feld; SupabaseRepository sammelt pro Match einen Error und wirft
    // am Ende EIN RepositoryError mit einem Error[]-originalError.
    const postgrestError = { message: 'TypeError: Load failed', details: '', hint: '', code: '' };
    const perMatchErrors = [new Error(`Match a: ${postgrestError.message}`)];
    const realError = new RepositoryError(
      'updateMatches',
      `Failed to update matches/tournament: ${perMatchErrors.map((e) => e.message).join('; ')}`,
      perMatchErrors
    );
    const execute = vi.fn().mockRejectedValue(realError);
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    for (let i = 0; i < 20; i++) {
      await queue.process();
    }

    expect(execute).toHaveBeenCalledTimes(20);
    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getFailedCount()).toBe(0);
    const stored = JSON.parse(mockStorage.get('test_queue_v1') ?? '[]') as GenericMutationItem<TestType>[];
    expect(stored[0].retryCount).toBe(0);
  });

  it('HTTP 429 zählt nicht als Fehlversuch — Eintrag bleibt wartend', async () => {
    const rateLimited = Object.assign(new Error('Too Many Requests'), { status: 429 });
    const execute = vi.fn().mockRejectedValue(rateLimited);
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('SAVE_THING', { id: 'a' });

    onlineSpy.mockReturnValue(true);
    for (let i = 0; i < 5; i++) {
      await queue.process();
    }

    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('nutzt den konfigurierten execute-Callback statt eines Switch auf Mutation-Typen', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const { queue } = makeQueue({ execute, online: false });
    queue.enqueue('DELETE_THING', 'thing-1');

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DELETE_THING', payload: 'thing-1' })
    );
  });
});
