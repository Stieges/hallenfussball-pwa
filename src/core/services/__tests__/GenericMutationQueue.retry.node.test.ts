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

import 'fake-indexeddb/auto';
import { GenericMutationQueue, type GenericMutationItem } from '../GenericMutationQueue';
import { MutationQueue } from '../MutationQueue';
import { RepositoryError, TeamStillReferencedError } from '../../errors';
import type { QueueTimers } from '../mutationQueueRetry';
import { REQUEST_TIMEOUT_MS } from '../../utils/syncRetryTiming';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { Tournament } from '../../models/types';

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
let q: GenericMutationQueue<QType> | undefined;
let mq: MutationQueue | undefined;
let setOnLine: (v: boolean) => void;

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) { await Promise.resolve(); }
};

function rlsError(): Error {
  return Object.assign(new Error('new row violates row-level security policy'), { code: '42501' });
}

function tour(id: string): Tournament {
  return { id, title: `Turnier ${id}`, matches: [] } as unknown as Tournament;
}

function makeRealQueue(save: ReturnType<typeof vi.fn>): MutationQueue {
  const supabaseRepo = { save } as unknown as SupabaseRepository;
  return new MutationQueue(supabaseRepo, undefined, recTimers);
}

function mqRetryCount(): number {
  const raw = mockStorage.get('mutation_queue_v1') ?? '[]';
  const items = JSON.parse(raw) as GenericMutationItem<string>[];
  return items[0]?.retryCount ?? 0;
}

function openTimers(): number {
  return openHandles.size;
}

function storedRetryCount(key = 'test_queue_retry_v1'): number {
  const raw = mockStorage.get(key) ?? '[]';
  const items = JSON.parse(raw) as GenericMutationItem<QType>[];
  return items[0]?.retryCount ?? 0;
}

function netError(): RepositoryError {
  return new RepositoryError('saveTournament', 'TypeError: Failed to fetch', {
    code: '',
    message: 'TypeError: Failed to fetch',
  });
}

function makeQ(
  execute: (item: GenericMutationItem<QType>) => Promise<void>,
  storageKey = 'test_queue_retry_v1',
): GenericMutationQueue<QType> {
  return new GenericMutationQueue<QType>({
    storageKey,
    failedStorageKey: `${storageKey}_failed`,
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
    q?.dispose();
    mq?.dispose();
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

  it('Test 3 (@FU-013): echter Fehler → delays [30000], retryCount 1; Grenze: Dead-Letter erst bei t = 120000', async () => {
    const execute = vi.fn().mockRejectedValue(rlsError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([30000]);
    expect(storedRetryCount()).toBe(1);
    expect(q.getFailedCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(29999);
    expect(storedRetryCount()).toBe(4);
    expect(q.getFailedCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(q.getFailedCount()).toBe(1);
    expect(q.getFailedMutations()[0].retryCount).toBe(5);
  });

  it('Test 4 (@FU-013): Erfolg → nach tick(60000) keine weiteren execute-Aufrufe, openTimers 0', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    await vi.advanceTimersByTimeAsync(60000);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(openTimers()).toBe(0);
  });

  it('Test 5a (@FU-013): kein Doppel-Timer – parallele process()-Aufrufe bei hängendem execute', async () => {
    let rejectD: (e: unknown) => void = () => undefined;
    const d = new Promise<void>((_res, rej) => { rejectD = rej; });
    const execute = vi.fn(() => d);
    q = makeQ(execute);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    void q.process();
    void q.process();
    void q.process();
    expect(execute).toHaveBeenCalledTimes(1);

    rejectD(netError());
    await settle();
    expect(openTimers()).toBe(1);
  });

  it('Test 5b (@FU-013): kein Doppel-Timer – drei Prozess-Läufe, nach jedem genau ein offener Timer', async () => {
    const execute = vi.fn().mockRejectedValue(netError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(openTimers()).toBe(1);
    await q.process();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(openTimers()).toBe(1);
    await q.process();
    expect(execute).toHaveBeenCalledTimes(3);
    expect(openTimers()).toBe(1);
  });

  it('Test 6 (@FU-013): offline beim Planen → kein Zeitgeber (Gegenbeispiel: online → delays [1000])', async () => {
    const execute = vi.fn(async () => {
      setOnLine(false);
      throw netError();
    });
    q = makeQ(execute);
    setOnLine(true);
    q.enqueue('SAVE_THING', { id: 'a' });
    await settle();
    expect(delays).toEqual([]);
    expect(openTimers()).toBe(0);

    const execute2 = vi.fn().mockRejectedValue(netError());
    const q2 = makeQ(execute2 as (item: GenericMutationItem<QType>) => Promise<void>, 'test_queue_retry_online_v1');
    setOnLine(true);
    q2.enqueue('SAVE_THING', { id: 'b' });
    await settle();
    expect(delays).toEqual([1000]);
    expect(openTimers()).toBe(1);
    q2.dispose();
  });

  it('Test 7 (@FU-013): dispose → offener Timer feuert nicht, execute bleibt bei 1', async () => {
    const execute = vi.fn().mockRejectedValue(netError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(openTimers()).toBe(1);
    q.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(openTimers()).toBe(0);
  });

  it('Test 8 (@FU-013): Sperre – processIfDue 3× während 30 s kein Versuch, nach tick(30000) execute 2×', async () => {
    const execute = vi.fn().mockRejectedValue(rlsError());
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(storedRetryCount()).toBe(1);

    await q.processIfDue();
    await q.processIfDue();
    await q.processIfDue();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(storedRetryCount()).toBe(1);
    expect(openTimers()).toBe(1);

    await vi.advanceTimersByTimeAsync(30000);
    expect(execute).toHaveBeenCalledTimes(2);

    // Gegenbeispiel A: nach transientem Fehler wirkt ein Anstoß sofort
    const execT = vi.fn().mockRejectedValue(netError());
    const qt = makeQ(execT as (item: GenericMutationItem<QType>) => Promise<void>, 'test_queue_retry_tr_v1');
    setOnLine(false);
    qt.enqueue('SAVE_THING', { id: 't' });
    setOnLine(true);
    await qt.process();
    await qt.processIfDue();
    expect(execT).toHaveBeenCalledTimes(2);
    qt.dispose();

    // Gegenbeispiel B: process() (Bestand) zaehlt in der Sperre weiter
    const execP = vi.fn().mockRejectedValue(rlsError());
    const qp = makeQ(execP as (item: GenericMutationItem<QType>) => Promise<void>, 'test_queue_retry_proc_v1');
    setOnLine(false);
    qp.enqueue('SAVE_THING', { id: 'p' });
    setOnLine(true);
    await qp.process();
    await qp.process();
    expect(execP).toHaveBeenCalledTimes(2);
    expect(storedRetryCount('test_queue_retry_proc_v1')).toBe(2);
    qp.dispose();
  });

  it('Gegenbeispiel (c) (@FU-004): TeamStillReferencedError bleibt permanent – retryCount 1, delays [30000]', async () => {
    const execute = vi.fn().mockRejectedValue(new TeamStillReferencedError('m1'));
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([30000]);
    expect(storedRetryCount()).toBe(1);
    expect(q.getFailedCount()).toBe(0);
    expect(q.getPendingCount()).toBe(1);
  });

  it('Review-Fall (@FU-013): AuthRetryableFetchError mit status 503 → transient, retryCount 0', async () => {
    const authErr = Object.assign(new Error('HTTP 503'), { name: 'AuthRetryableFetchError', status: 503 });
    const err = new RepositoryError('save', 'HTTP 503', authErr);
    const execute = vi.fn().mockRejectedValue(err);
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([1000]);
    expect(storedRetryCount()).toBe(0);
    expect(q.getFailedCount()).toBe(0);
  });

  it('Review-Fall (@FU-013): code "23" als Text ist nicht code 23 – permanent, delays [30000]', async () => {
    const err = Object.assign(new Error('Datenfehler'), { code: '23' });
    const execute = vi.fn().mockRejectedValue(err);
    q = makeQ(execute as (item: GenericMutationItem<QType>) => Promise<void>);
    setOnLine(false);
    q.enqueue('SAVE_THING', { id: 'a' });
    setOnLine(true);

    await q.process();
    expect(delays).toEqual([30000]);
    expect(storedRetryCount()).toBe(1);
    expect(q.getFailedCount()).toBe(0);
  });

  // ===========================================================================
  // Pflichttest echter Weg: MutationQueue-Spezialisierung, SupabaseRepository
  // nur an save gemockt (RepositoryError('saveTournament','TypeError: Failed to fetch',…))
  // ===========================================================================

  it('echter Weg Test 1 (@FU-013): delays [1000,2000,5000,5000,5000] ueber MutationQueue', async () => {
    const save = vi.fn().mockRejectedValue(
      new RepositoryError('saveTournament', 'TypeError: Failed to fetch', { code: '', message: 'TypeError: Failed to fetch' })
    );
    mq = makeRealQueue(save);
    setOnLine(false);
    mq.enqueue('SAVE_TOURNAMENT', tour('t1'));
    setOnLine(true);

    await mq.process();
    expect(delays).toEqual([1000]);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(delays).toEqual([1000, 2000, 5000, 5000, 5000]);
    expect(save).toHaveBeenCalledTimes(5);
    expect(mqRetryCount()).toBe(0);
    expect(mq.getFailedCount()).toBe(0);
  });

  it('echter Weg Test 2 (@FU-013): Internet zurueck ohne online → nach tick(10000) Queue leer (3 Items)', async () => {
    const save = vi.fn().mockRejectedValue(
      new RepositoryError('saveTournament', 'TypeError: Failed to fetch', { code: '', message: 'TypeError: Failed to fetch' })
    );
    mq = makeRealQueue(save);
    setOnLine(false);
    mq.enqueue('SAVE_TOURNAMENT', tour('t1'));
    mq.enqueue('SAVE_TOURNAMENT', tour('t2'));
    mq.enqueue('SAVE_TOURNAMENT', tour('t3'));
    setOnLine(true);

    await mq.process();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(6);
    expect(mq.getPendingCount()).toBe(3);

    save.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(10000);
    expect(mq.getPendingCount()).toBe(0);
    expect(openTimers()).toBe(0);
  });

  it('echter Weg Test 8 (@FU-013): Sperre nach echtem Fehler – processIfDue kein Versuch, nach 30 s execute 2×', async () => {
    const save = vi.fn().mockRejectedValue(rlsError());
    mq = makeRealQueue(save);
    setOnLine(false);
    mq.enqueue('SAVE_TOURNAMENT', tour('t1'));
    setOnLine(true);

    await mq.process();
    expect(save).toHaveBeenCalledTimes(1);
    expect(mqRetryCount()).toBe(1);

    await mq.processIfDue();
    await mq.processIfDue();
    await mq.processIfDue();
    expect(save).toHaveBeenCalledTimes(1);
    expect(openTimers()).toBe(1);

    await vi.advanceTimersByTimeAsync(30000);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
