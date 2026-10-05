import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueRetryTimer, RETRY_BACKOFF_MS, HOLD_RETRY_MS, globalQueueTimers } from '../mutationQueueRetry';

describe('QueueRetryTimer (A-06d)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('liefert die Folge 1000/2000/5000/5000/5000 und deckelt danach', () => {
    const t = new QueueRetryTimer(globalQueueTimers(), () => undefined);
    const seen = [t.takeBackoffMs(), t.takeBackoffMs(), t.takeBackoffMs(), t.takeBackoffMs(), t.takeBackoffMs(), t.takeBackoffMs()];
    expect(seen).toEqual([1000, 2000, 5000, 5000, 5000, 5000]);
    expect(RETRY_BACKOFF_MS).toEqual([1000, 2000, 5000, 5000, 5000]);
  });

  it('reset setzt die Folge zurück, HOLD_RETRY_MS ist 30000', () => {
    const t = new QueueRetryTimer(globalQueueTimers(), () => undefined);
    t.takeBackoffMs();
    t.takeBackoffMs();
    t.reset();
    expect(t.takeBackoffMs()).toBe(1000);
    expect(HOLD_RETRY_MS).toBe(30000);
  });

  it('schedule feuert nach ms und ist idempotent (nie zwei Timer)', () => {
    const onFire = vi.fn();
    const t = new QueueRetryTimer(globalQueueTimers(), onFire);
    t.schedule(1000);
    t.schedule(1000);
    expect(t.isOpen).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(t.isOpen).toBe(false);
  });

  it('clear löscht den anstehenden Timer', () => {
    const onFire = vi.fn();
    const t = new QueueRetryTimer(globalQueueTimers(), onFire);
    t.schedule(5000);
    t.clear();
    expect(t.isOpen).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('Timer-Rückruf löscht die Sperre (hold) vor onFire', () => {
    const onFire = vi.fn();
    const t = new QueueRetryTimer(globalQueueTimers(), onFire);
    t.hold = true;
    t.schedule(1000);
    vi.advanceTimersByTime(1000);
    expect(t.hold).toBe(false);
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// GenericMutationQueue – Weg B (Brief A5, Tests 1/2/9 + spaeter 3-8)
// =============================================================================

import { GenericMutationQueue, type GenericMutationItem } from '../GenericMutationQueue';
import { RepositoryError } from '../../errors';
import type { QueueTimers } from '../mutationQueueRetry';
import { REQUEST_TIMEOUT_MS } from '../../utils/syncRetryTiming';

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
let qId = 0;
vi.mock('../../../utils/idGenerator', () => ({ generateUniqueId: vi.fn(() => `retry-q-${++qId}`) }));

type QType = 'SAVE_THING' | 'DELETE_THING';

let delays: number[];
let limitDelays: number[];
let openHandles: Set<unknown>;
let recTimers: QueueTimers;
let q: GenericMutationQueue<QType>;
let setOnLine: (v: boolean) => void;

function openTimers(): number {
  return openHandles.size;
}

function storedRetryCount(): number {
  const raw = mockStorage.get('test_queue_retry_v1') ?? '[]';
  const items = JSON.parse(raw) as GenericMutationItem<QType>[];
  return items[0]?.retryCount ?? 0;
}

function netError(): RepositoryError {
  return new RepositoryError('saveTournament', 'TypeError: Failed to fetch', {
    code: '',
    message: 'TypeError: Failed to fetch',
  });
}

function makeQ(execute: (item: GenericMutationItem<QType>) => Promise<void>): GenericMutationQueue<QType> {
  return new GenericMutationQueue<QType>({
    storageKey: 'test_queue_retry_v1',
    failedStorageKey: 'test_queue_retry_failed_v1',
    execute,
    coalesceKey: (type, p) =>
      type === 'SAVE_THING' && (p as { id?: string })?.id ? `SAVE:${(p as { id: string }).id}` : null,
    sentryFeature: 'sync',
    timers: recTimers,
  });
}

describe('GenericMutationQueue Weg B (A-06d, @FU-013/@FU-004)', () => {
  beforeEach(() => {
    mockStorage.clear();
    qId = 0;
    delays = [];
    limitDelays = [];
    openHandles = new Set();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    recTimers = {
      setTimeout: (cb, ms) => {
        if (ms === REQUEST_TIMEOUT_MS) { limitDelays.push(ms); } else { delays.push(ms); }
        const h = setTimeout(() => { openHandles.delete(h); cb(); }, ms);
        openHandles.add(h);
        return h;
      },
      clearTimeout: (h) => { openHandles.delete(h); clearTimeout(h); },
    };
    const nav = { onLine: true };
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    setOnLine = (v: boolean) => { nav.onLine = v; };
  });

  afterEach(() => {
    q.dispose();
    vi.useRealTimers();
  });

  it('Test 1 (@FU-013): Netzfehler → delays [1000,2000,5000,5000,5000], retryCount bleibt 0', async () => {
    const execute = vi.fn().mockRejectedValue(netError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([1000]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(delays).toEqual([1000, 2000]);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(delays).toEqual([1000, 2000, 5000, 5000, 5000]);
    expect(limitDelays).toEqual([]);
    expect(storedRetryCount()).toBe(0);
    expect(q.getFailedCount()).toBe(0);
  });

  it('Test 2 (@FU-013): Internet zurueck ohne online → nach tick(10000) Queue leer (≥3 Items, ≥6 Fehlversuche)', async () => {
    const execute = vi.fn().mockRejectedValue(netError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    q.enqueue('SAVE_THING', { id: 'b' });
    q.enqueue('DELETE_THING', 'c');
    setOnLine(true);

    await q.process();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(execute).toHaveBeenCalledTimes(6);
    expect(q.getPendingCount()).toBe(3);

    execute.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(10000);
    expect(q.getPendingCount()).toBe(0);
    expect(openTimers()).toBe(0);
  });

  it('Test 9 (@FU-004): getUser-Netzfehler-Form → transient, retryCount 0, delays [1000], nicht in Fehlerliste', async () => {
    const authErr = Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 });
    const err = new RepositoryError('save', 'Failed to fetch', authErr);
    const execute = vi.fn().mockRejectedValue(err);
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([1000]);
    expect(storedRetryCount()).toBe(0);
    expect(q.getFailedCount()).toBe(0);
    expect(q.getPendingCount()).toBe(1);
  });
});
