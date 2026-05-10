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
});
