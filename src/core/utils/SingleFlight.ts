/**
 * SingleFlight Utility
 *
 * Provides utilities for:
 * - Timeout protection for async operations
 * - Exponential backoff retry logic
 * - Single-flight deduplication (coalesce concurrent calls)
 *
 * Part of Live-Cockpit Resilience (H-4)
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Timeout for each attempt in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Base delay for exponential backoff in milliseconds (default: 100) */
  backoffBaseMs?: number;
  /** Maximum backoff delay in milliseconds (default: 2000) */
  maxBackoffMs?: number;
}

/**
 * Executes an async operation with timeout protection.
 *
 * @param operation - The async function to execute
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise that rejects if the operation times out
 *
 * @example
 * ```typescript
 * const result = await executeWithTimeout(
 *   () => fetchData(),
 *   5000
 * );
 * ```
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      // Allow the timer to be garbage collected if the operation completes first
      // Note: This is a best-effort cleanup, Promise.race doesn't cancel the loser
      void id;
    }),
  ]);
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 *
 * @param operation - The async function to execute
 * @param isRetryable - Predicate to determine if an error should trigger a retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the operation result or rejects after exhausting retries
 *
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   () => saveMatch(match),
 *   (error) => error instanceof OptimisticLockError,
 *   { maxRetries: 3, timeoutMs: 10000 }
 * );
 * ```
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeoutMs = 10000,
    backoffBaseMs = 100,
    maxBackoffMs = 2000,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await executeWithTimeout(operation, timeoutMs);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on timeout
      if (lastError.message.includes('timed out')) {
        throw lastError;
      }

      // Check if retryable and not the last attempt
      if (!isRetryable(error) || attempt >= maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, ... up to maxBackoffMs
      const delay = Math.min(
        backoffBaseMs * Math.pow(2, attempt),
        maxBackoffMs
      );

      // Log retry attempt
      console.warn(
        `[executeWithRetry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`,
        lastError.message
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

/**
 * SingleFlight ensures only one instance of an operation runs at a time.
 * Subsequent calls while an operation is in-flight will wait for and share
 * the result of the existing operation.
 *
 * Useful for:
 * - Deduplicating concurrent refreshMatches() calls
 * - Preventing parallel data fetches for the same resource
 *
 * @example
 * ```typescript
 * const refreshFlight = new SingleFlight<void>();
 *
 * // These concurrent calls will only execute refreshMatches once
 * await Promise.all([
 *   refreshFlight.execute(() => refreshMatches()),
 *   refreshFlight.execute(() => refreshMatches()),
 *   refreshFlight.execute(() => refreshMatches()),
 * ]);
 * ```
 */
export class SingleFlight<T> {
  private inFlight: Promise<T> | null = null;

  /**
   * Execute the operation, or wait for an existing in-flight operation.
   *
   * @param fn - The async function to execute
   * @returns Promise that resolves with the operation result
   */
  async execute(fn: () => Promise<T>): Promise<T> {
    // If there's already an operation in flight, return its promise
    if (this.inFlight) {
      return this.inFlight;
    }

    // Start the operation and track its promise
    this.inFlight = fn();

    try {
      return await this.inFlight;
    } finally {
      // Clear the in-flight promise when done (success or error)
      this.inFlight = null;
    }
  }

  /**
   * Check if there's currently an operation in flight.
   */
  isInFlight(): boolean {
    return this.inFlight !== null;
  }
}

export default SingleFlight;
