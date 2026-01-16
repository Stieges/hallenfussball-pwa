/**
 * RetryService - Centralized retry logic with exponential backoff
 *
 * Extracted from AuthContext for reusability across the application.
 * Handles transient failures with configurable retry behavior.
 *
 * @example
 * ```typescript
 * const retryService = new RetryService({ maxAttempts: 3, baseDelay: 2000 });
 *
 * const result = await retryService.execute(
 *   () => fetchData(),
 *   {
 *     shouldRetry: (error) => error.name !== 'AbortError',
 *     onRetry: (attempt) => console.log(`Retry attempt ${attempt}`),
 *   }
 * );
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffFactor: number;
}

export interface RetryState {
  /** Current attempt number (0 = not started, 1 = first attempt) */
  attempt: number;
  /** When the next retry is scheduled (null if not waiting) */
  nextRetryAt: Date | null;
  /** Whether currently in a retry cycle */
  isRetrying: boolean;
  /** Last error encountered */
  lastError: Error | null;
}

export interface RetryOptions<T> {
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  /** Determines if the error should trigger a retry (default: always retry) */
  shouldRetry?: (error: Error) => boolean;
  /** Called on successful completion */
  onSuccess?: (result: T, attempts: number) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (error: Error, attempts: number) => void;
  /** AbortSignal to cancel the retry operation */
  signal?: AbortSignal;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

// =============================================================================
// SERVICE
// =============================================================================

export class RetryService {
  private config: RetryConfig;
  private state: RetryState;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  /**
   * Execute an operation with retry logic
   *
   * @param operation - The async operation to execute
   * @param options - Optional callbacks and configuration
   * @returns The result of the operation
   * @throws The last error if all retries are exhausted
   */
  async execute<T>(
    operation: () => Promise<T>,
    options?: RetryOptions<T>
  ): Promise<T> {
    this.reset();
    this.state.isRetrying = true;

    while (this.state.attempt < this.config.maxAttempts) {
      // Check for abort before each attempt
      if (options?.signal?.aborted) {
        this.state.isRetrying = false;
        throw new DOMException('Retry operation aborted', 'AbortError');
      }

      this.state.attempt++;

      try {
        const result = await operation();

        // Success
        this.state.isRetrying = false;
        this.state.lastError = null;
        options?.onSuccess?.(result, this.state.attempt);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.state.lastError = err;

        // Check if we should retry
        const shouldRetry = options?.shouldRetry?.(err) ?? true;
        const hasAttemptsRemaining = this.state.attempt < this.config.maxAttempts;

        if (!shouldRetry || !hasAttemptsRemaining) {
          this.state.isRetrying = false;
          options?.onExhausted?.(err, this.state.attempt);
          throw err;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay();
        this.state.nextRetryAt = new Date(Date.now() + delay);

        // Notify before waiting
        options?.onRetry?.(this.state.attempt, err, delay);

        // Wait before next attempt
        await this.delay(delay, options?.signal);
        this.state.nextRetryAt = null;
      }
    }

    // Should never reach here, but TypeScript needs it
    this.state.isRetrying = false;
    const finalError = this.state.lastError ?? new Error('Max retry attempts reached');
    options?.onExhausted?.(finalError, this.state.attempt);
    throw finalError;
  }

  /**
   * Reset the retry state
   */
  reset(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    this.state = this.createInitialState();
  }

  /**
   * Get current retry state (immutable copy)
   */
  getState(): Readonly<RetryState> {
    return { ...this.state };
  }

  /**
   * Get configuration (immutable copy)
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private createInitialState(): RetryState {
    return {
      attempt: 0,
      nextRetryAt: null,
      isRetrying: false,
      lastError: null,
    };
  }

  private calculateDelay(): number {
    // Exponential backoff: baseDelay * (backoffFactor ^ (attempt - 1))
    const exponentialDelay =
      this.config.baseDelay *
      Math.pow(this.config.backoffFactor, this.state.attempt - 1);

    // Cap at maxDelay
    return Math.min(exponentialDelay, this.config.maxDelay);
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Delay aborted', 'AbortError'));
        return;
      }

      const onAbort = () => {
        if (this.pendingTimeout) {
          clearTimeout(this.pendingTimeout);
          this.pendingTimeout = null;
        }
        reject(new DOMException('Delay aborted', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      this.pendingTimeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        this.pendingTimeout = null;
        resolve();
      }, ms);
    });
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a RetryService configured for auth operations
 *
 * - 3 attempts max
 * - 2 second base delay
 * - Skips retry for AbortErrors (transient, will retry via separate mechanism)
 */
export function createAuthRetryService(): RetryService {
  return new RetryService({
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffFactor: 2,
  });
}

/**
 * Create a RetryService configured for network operations
 *
 * - 5 attempts max
 * - 1 second base delay
 * - Longer backoff for network stability
 */
export function createNetworkRetryService(): RetryService {
  return new RetryService({
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffFactor: 2,
  });
}

/**
 * Utility: Check if an error is an AbortError (should not trigger retry)
 */
export function isAbortError(error: Error): boolean {
  return (
    error.name === 'AbortError' ||
    error.message.includes('aborted') ||
    error.message.includes('abort')
  );
}

/**
 * Utility: Check if an error is a transient network error (should retry)
 */
export function isTransientError(error: Error): boolean {
  const transientMessages = [
    'network',
    'timeout',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'fetch failed',
    'Failed to fetch',
  ];

  return transientMessages.some(
    (msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase()) ||
      error.name.toLowerCase().includes(msg.toLowerCase())
  );
}

export default RetryService;
