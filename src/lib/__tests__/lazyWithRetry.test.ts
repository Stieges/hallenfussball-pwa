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
});
