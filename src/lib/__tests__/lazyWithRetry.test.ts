import { describe, it, expect, vi } from 'vitest';
import { lazyWithRetry } from '../lazyWithRetry';

describe('lazyWithRetry', () => {
  it('returns a React.lazy component when import succeeds first try', async () => {
    const fakeComponent = { default: () => null };
    const importer = vi.fn().mockResolvedValue(fakeComponent);

    const LazyComp = lazyWithRetry(importer, 'TestChunk');

    // React.lazy returns a special exotic component
    expect(LazyComp).toHaveProperty('$$typeof');
    expect(LazyComp).toHaveProperty('_payload');

    expect(importer).not.toHaveBeenCalled();
  });

  it('retries on transient import failure and eventually succeeds', async () => {
    const fakeComponent = { default: () => null };
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(fakeComponent);

    const mod = await import('../lazyWithRetry');
    expect(typeof mod.importWithRetry).toBe('function');
    await expect(mod.importWithRetry(importer, 'TestChunk')).resolves.toEqual(fakeComponent);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('reports to Sentry and dispatches event after all retries fail', async () => {
    const sentryMock = vi.hoisted(() => vi.fn());
    vi.mock('../sentry', () => ({ captureFeatureError: sentryMock }));

    const eventListener = vi.fn();
    window.addEventListener('lazy-import-failed', eventListener);

    const importer = vi.fn().mockRejectedValue(new Error('chunk not found'));
    const mod = await import('../lazyWithRetry');

    await expect(mod.importWithRetry(importer, 'FailChunk')).rejects.toThrow('chunk not found');
    expect(importer).toHaveBeenCalledTimes(3);
    expect(sentryMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'chunk not found' }),
      'lazy-import',
      'FailChunk',
      { attempts: 3 },
    );
    expect(eventListener).toHaveBeenCalled();
    const customEvent = eventListener.mock.calls[0][0] as CustomEvent;
    expect(customEvent.detail).toEqual({
      chunkName: 'FailChunk',
      error: expect.any(Error),
      attempts: 3,
    });

    window.removeEventListener('lazy-import-failed', eventListener);
  });
});
