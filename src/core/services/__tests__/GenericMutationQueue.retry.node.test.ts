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
