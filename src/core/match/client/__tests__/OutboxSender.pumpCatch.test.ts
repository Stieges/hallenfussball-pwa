/**
 * Task C3a-0, M-g: Ein Fehler, der aus der Pump-Schleife entkommt (heute
 * unerreichbar, da `sendOneBatch` selbst alles faengt -- aber defensiv, C3
 * haengt neue Aufrufer an), wird als Status/`lastError` festgehalten statt
 * still verworfen zu werden (`.catch(() => undefined)`).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { makeHarness } from './outboxHarness';

describe('OutboxSender: M-g -- Fehler aus der Pump-Schleife', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('setzt lastError statt die Ablehnung unbehandelt zu lassen', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm1', ctx);
    await h.store.addPending('acc', 'm1', ev({ id: 'a1', type: 'GOAL', at: 1 }));

    const sender = h.sender as unknown as { sendOneBatch: (queue: unknown) => Promise<string> };
    vi.spyOn(sender, 'sendOneBatch').mockRejectedValueOnce(new Error('unerwarteter Fehler'));

    await expect(h.sender.start('acc')).resolves.toBeUndefined();
    await h.settle();

    expect(h.sender.getStatus().lastError).toBe('unerwarteter Fehler');
  });
});
