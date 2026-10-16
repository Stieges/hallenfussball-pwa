/**
 * resyncNow (Brief A8, @FU-015): Teilschritte parallel, Fehler still, Gast-Regel.
 */
import { describe, it, expect, vi } from 'vitest';
import { resyncNow, type ResyncParts } from '../resyncNow';

function fakeParts(overrides: Partial<ResyncParts> = {}): ResyncParts & {
  sync: ReturnType<typeof vi.fn>;
  kick: ReturnType<typeof vi.fn>;
  catchUp: ReturnType<typeof vi.fn>;
  processIfDue: ReturnType<typeof vi.fn>;
} {
  const sync = vi.fn(() => Promise.resolve());
  const kick = vi.fn(() => Promise.resolve());
  const catchUp = vi.fn(() => Promise.resolve());
  const processIfDue = vi.fn(() => Promise.resolve());
  return {
    clock: { sync },
    sender: { kick },
    engine: { catchUpLoaded: catchUp },
    mutationQueue: { processIfDue },
    isGuest: false,
    ...overrides,
    sync,
    kick,
    catchUp,
    processIfDue,
  };
}

describe('resyncNow', () => {
  it('ruft alle vier Teilschritte auf und loest auf', async () => {
    const parts = fakeParts();
    await expect(resyncNow(parts)).resolves.toBeUndefined();
    expect(parts.sync).toHaveBeenCalledTimes(1);
    expect(parts.kick).toHaveBeenCalledTimes(1);
    expect(parts.catchUp).toHaveBeenCalledTimes(1);
    expect(parts.processIfDue).toHaveBeenCalledTimes(1);
  });

  it('haengendes catchUpLoaded blockiert processIfDue nicht', () => {
    const parts = fakeParts({
      engine: { catchUpLoaded: () => new Promise<void>(() => undefined) },
    });
    void resyncNow(parts);
    // Direkt nach dem Aufruf, ohne auf das (haengende) Ergebnis zu warten.
    expect(parts.processIfDue).toHaveBeenCalledTimes(1);
  });

  it('lehnt kick ab -> Ergebnis lehnt nicht ab, andere Schritte laufen weiter', async () => {
    const parts = fakeParts();
    parts.kick.mockImplementation(() => Promise.reject(new Error('kaputt')));
    await expect(resyncNow(parts)).resolves.toBeUndefined();
    expect(parts.kick).toHaveBeenCalledTimes(1);
    expect(parts.processIfDue).toHaveBeenCalledTimes(1);
  });

  it('wirft clock.sync synchron -> processIfDue laeuft trotzdem, kein Wurf', async () => {
    const parts = fakeParts({
      clock: {
        sync: () => {
          throw new Error('sync sofort kaputt');
        },
      },
    });
    await expect(resyncNow(parts)).resolves.toBeUndefined();
    expect(parts.processIfDue).toHaveBeenCalledTimes(1);
    expect(parts.kick).toHaveBeenCalledTimes(1);
  });

  it('Gast: nur processIfDue, kein kick/sync/catchUp', async () => {
    const parts = fakeParts({ isGuest: true });
    await resyncNow(parts);
    expect(parts.processIfDue).toHaveBeenCalledTimes(1);
    expect(parts.sync).not.toHaveBeenCalled();
    expect(parts.kick).not.toHaveBeenCalled();
    expect(parts.catchUp).not.toHaveBeenCalled();
  });

  it('mutationQueue null -> kein Wurf, Weg A laeuft', async () => {
    const parts = fakeParts({ mutationQueue: null });
    await expect(resyncNow(parts)).resolves.toBeUndefined();
    expect(parts.kick).toHaveBeenCalledTimes(1);
    expect(parts.processIfDue).not.toHaveBeenCalled();
  });
});
