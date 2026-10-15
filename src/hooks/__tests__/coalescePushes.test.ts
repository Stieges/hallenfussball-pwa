/**
 * A-08f3b2-F (Review I-1, @FU-087): Pushes eines Turniers werden gebündelt -- Debounce mit Max-Wait.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPushCoalescer, PUSH_COALESCE_DEBOUNCE_MS, PUSH_COALESCE_MAX_WAIT_MS } from '../coalescePushes';

describe('createPushCoalescer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ein Ereignis → genau ein Aufruf nach dem Debounce, nicht vorher', () => {
    const fn = vi.fn();
    const c = createPushCoalescer(fn);
    c.trigger();
    vi.advanceTimersByTime(PUSH_COALESCE_DEBOUNCE_MS - 1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('38 Ereignisse im 10-ms-Takt → ein Aufruf', () => {
    const fn = vi.fn();
    const c = createPushCoalescer(fn);
    for (let i = 0; i < 38; i++) { c.trigger(); vi.advanceTimersByTime(10); }
    vi.advanceTimersByTime(PUSH_COALESCE_MAX_WAIT_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Dauerfeuer → spätestens nach Max-Wait ein Aufruf (Anzeige bleibt ≤ 3 s, @FU-087)', () => {
    const fn = vi.fn();
    const c = createPushCoalescer(fn);
    for (let t = 0; t < PUSH_COALESCE_MAX_WAIT_MS; t += 100) { c.trigger(); vi.advanceTimersByTime(100); }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Abstand > Max-Wait → je ein Aufruf', () => {
    const fn = vi.fn();
    const c = createPushCoalescer(fn);
    for (let i = 0; i < 3; i++) { c.trigger(); vi.advanceTimersByTime(PUSH_COALESCE_MAX_WAIT_MS + 100); }
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('cancel verwirft ein ausstehendes Ereignis', () => {
    const fn = vi.fn();
    const c = createPushCoalescer(fn);
    c.trigger();
    c.cancel();
    vi.advanceTimersByTime(PUSH_COALESCE_MAX_WAIT_MS * 2);
    expect(fn).not.toHaveBeenCalled();
  });
});
