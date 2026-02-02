import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RetryService,
  createAuthRetryService,
  createNetworkRetryService,
  isTransientError,
} from '../RetryService';

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Constructor & Config
// =============================================================================

describe('RetryService constructor & config', () => {
  it('uses default config when none provided', () => {
    const service = new RetryService();
    const config = service.getConfig();
    expect(config.maxAttempts).toBe(3);
    expect(config.baseDelay).toBe(1000);
    expect(config.maxDelay).toBe(30000);
    expect(config.backoffFactor).toBe(2);
  });

  it('merges partial config with defaults', () => {
    const service = new RetryService({ maxAttempts: 5 });
    const config = service.getConfig();
    expect(config.maxAttempts).toBe(5);
    expect(config.baseDelay).toBe(1000); // default
  });

  it('updateConfig merges into existing config', () => {
    const service = new RetryService();
    service.updateConfig({ maxDelay: 5000 });
    expect(service.getConfig().maxDelay).toBe(5000);
    expect(service.getConfig().maxAttempts).toBe(3); // unchanged
  });
});

// =============================================================================
// getState & reset
// =============================================================================

describe('RetryService state', () => {
  it('initial state is clean', () => {
    const service = new RetryService();
    const state = service.getState();
    expect(state.attempt).toBe(0);
    expect(state.isRetrying).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.nextRetryAt).toBeNull();
  });

  it('reset clears state after failure', async () => {
    const service = new RetryService({ maxAttempts: 1 });
    const promise = service.execute(() => Promise.reject(new Error('fail')));
    await expect(promise).rejects.toThrow('fail');

    service.reset();
    const state = service.getState();
    expect(state.attempt).toBe(0);
    expect(state.isRetrying).toBe(false);
  });
});

// =============================================================================
// execute — success
// =============================================================================

describe('RetryService execute — success', () => {
  it('returns result on first attempt', async () => {
    const service = new RetryService();
    const result = await service.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('calls onSuccess with result and attempt count', async () => {
    const service = new RetryService();
    const onSuccess = vi.fn();
    await service.execute(() => Promise.resolve(42), { onSuccess });
    expect(onSuccess).toHaveBeenCalledWith(42, 1);
  });

  it('state shows not retrying after success', async () => {
    const service = new RetryService();
    await service.execute(() => Promise.resolve('done'));
    expect(service.getState().isRetrying).toBe(false);
    expect(service.getState().lastError).toBeNull();
  });
});

// =============================================================================
// execute — retry then success
// =============================================================================

describe('RetryService execute — retry then success', () => {
  it('retries on failure and succeeds on second attempt', async () => {
    const service = new RetryService({ maxAttempts: 3, baseDelay: 100, backoffFactor: 1 });
    let callCount = 0;
    const operation = () => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('transient'));
      }
      return Promise.resolve('success');
    };

    const promise = service.execute(operation);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe('success');
    expect(callCount).toBe(2);
  });

  it('calls onRetry with attempt, error, and delay', async () => {
    const service = new RetryService({ maxAttempts: 3, baseDelay: 1000, backoffFactor: 2 });
    let callCount = 0;
    const onRetry = vi.fn();
    const operation = () => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('fail'));
      }
      return Promise.resolve('ok');
    };

    const promise = service.execute(operation, { onRetry });
    await vi.advanceTimersByTimeAsync(1500);
    await promise;

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1000);
  });
});

// =============================================================================
// execute — all retries exhausted
// =============================================================================

describe('RetryService execute — exhausted', () => {
  it('throws last error when all attempts fail', async () => {
    const service = new RetryService({ maxAttempts: 2, baseDelay: 100, backoffFactor: 1 });
    const onExhausted = vi.fn();

    let caughtError: Error | undefined;
    const promise = service.execute(() => Promise.reject(new Error('always fail')), { onExhausted })
      .catch((e: Error) => { caughtError = e; });
    await vi.advanceTimersByTimeAsync(500);
    await promise;

    expect(caughtError?.message).toBe('always fail');
    expect(onExhausted).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it('state reflects last error after exhaustion', async () => {
    const service = new RetryService({ maxAttempts: 1 });
    try {
      await service.execute(() => Promise.reject(new Error('boom')));
    } catch {
      // expected
    }
    expect(service.getState().lastError?.message).toBe('boom');
    expect(service.getState().isRetrying).toBe(false);
  });
});

// =============================================================================
// shouldRetry option
// =============================================================================

describe('RetryService shouldRetry', () => {
  it('does not retry when shouldRetry returns false', async () => {
    const service = new RetryService({ maxAttempts: 3, baseDelay: 100 });
    let callCount = 0;
    const onExhausted = vi.fn();

    const promise = service.execute(
      () => {
        callCount++;
        return Promise.reject(new Error('non-retriable'));
      },
      {
        shouldRetry: () => false,
        onExhausted,
      }
    );

    await expect(promise).rejects.toThrow('non-retriable');
    expect(callCount).toBe(1);
    expect(onExhausted).toHaveBeenCalledWith(expect.any(Error), 1);
  });
});

// =============================================================================
// AbortSignal
// =============================================================================

describe('RetryService AbortSignal', () => {
  it('throws DOMException with name AbortError when signal is already aborted', async () => {
    const service = new RetryService();
    const controller = new AbortController();
    controller.abort();

    try {
      await service.execute(() => Promise.resolve('ok'), { signal: controller.signal });
      expect.fail('should have thrown');
    } catch (error) {
      expect((error as DOMException).name).toBe('AbortError');
    }
  });

  it('throws when signal is aborted during delay', async () => {
    const service = new RetryService({ maxAttempts: 3, baseDelay: 5000 });
    const controller = new AbortController();
    let callCount = 0;

    const promise = service.execute(
      () => {
        callCount++;
        return Promise.reject(new Error('fail'));
      },
      { signal: controller.signal }
    );

    // First attempt fails immediately, then delay starts.
    // Advance a bit (not enough to resolve the delay), then abort.
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();

    try {
      await promise;
      expect.fail('should have thrown');
    } catch (error) {
      expect((error as DOMException).name).toBe('AbortError');
    }
    // Only the first call should have happened before abort
    expect(callCount).toBe(1);
  });
});

// =============================================================================
// Exponential backoff
// =============================================================================

describe('RetryService exponential backoff', () => {
  it('calculates delays: 1s, 2s, 4s with backoffFactor=2', async () => {
    const service = new RetryService({ maxAttempts: 4, baseDelay: 1000, backoffFactor: 2, maxDelay: 30000 });
    const delays: number[] = [];
    const onRetry = (_attempt: number, _error: Error, delay: number) => {
      delays.push(delay);
    };

    let caughtError: Error | undefined;
    const promise = service.execute(() => Promise.reject(new Error('fail')), { onRetry })
      .catch((e: Error) => { caughtError = e; });

    // Advance enough time for all retries (1s + 2s + 4s = 7s)
    await vi.advanceTimersByTimeAsync(8000);
    await promise;

    expect(caughtError).toBeDefined();
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it('caps delay at maxDelay', async () => {
    const service = new RetryService({ maxAttempts: 4, baseDelay: 1000, backoffFactor: 10, maxDelay: 5000 });
    const delays: number[] = [];
    const onRetry = (_attempt: number, _error: Error, delay: number) => {
      delays.push(delay);
    };

    let caughtError: Error | undefined;
    const promise = service.execute(() => Promise.reject(new Error('fail')), { onRetry })
      .catch((e: Error) => { caughtError = e; });

    // Advance enough for all retries (1s + 5s + 5s = 11s)
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    expect(caughtError).toBeDefined();
    // delay 1: 1000*10^0 = 1000
    // delay 2: 1000*10^1 = 10000 -> capped at 5000
    // delay 3: 1000*10^2 = 100000 -> capped at 5000
    expect(delays).toEqual([1000, 5000, 5000]);
  });
});

// =============================================================================
// Factory functions
// =============================================================================

describe('Factory functions', () => {
  it('createAuthRetryService has correct config', () => {
    const service = createAuthRetryService();
    const config = service.getConfig();
    expect(config.maxAttempts).toBe(3);
    expect(config.baseDelay).toBe(2000);
    expect(config.maxDelay).toBe(30000);
  });

  it('createNetworkRetryService has correct config', () => {
    const service = createNetworkRetryService();
    const config = service.getConfig();
    expect(config.maxAttempts).toBe(5);
    expect(config.baseDelay).toBe(1000);
    expect(config.maxDelay).toBe(60000);
  });
});

// =============================================================================
// isTransientError
// =============================================================================

describe('isTransientError', () => {
  it('detects network errors', () => {
    expect(isTransientError(new Error('network error occurred'))).toBe(true);
  });

  it('detects timeout errors', () => {
    expect(isTransientError(new Error('Request timeout'))).toBe(true);
  });

  it('detects "Failed to fetch"', () => {
    expect(isTransientError(new Error('Failed to fetch'))).toBe(true);
  });

  it('detects ECONNRESET', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
  });

  it('returns false for non-transient errors', () => {
    expect(isTransientError(new Error('Not found'))).toBe(false);
    expect(isTransientError(new Error('Validation failed'))).toBe(false);
  });
});
