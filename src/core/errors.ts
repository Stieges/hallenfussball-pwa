// =============================================================================
// Error Hierarchy
// =============================================================================

/**
 * Base error class for application errors.
 * Provides feature/action tagging for Sentry integration via captureFeatureError().
 */
export class AppError extends Error {
  public readonly feature: string;
  public readonly action?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    feature: string,
    action?: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.feature = feature;
    this.action = action;
    this.context = context;
  }
}

/**
 * Error for repository/data-access operations.
 * Wraps Supabase errors (which are plain objects, not Error instances).
 */
export class RepositoryError extends AppError {
  public readonly operation: string;
  public readonly originalError?: unknown;

  constructor(operation: string, message: string, originalError?: unknown) {
    super(message, 'repository', operation, originalError !== null && originalError !== undefined ? { originalError: String(originalError) } : undefined);
    this.name = 'RepositoryError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Error for authentication failures.
 */
export class AuthenticationError extends AppError {
  constructor(message: string, action?: string) {
    super(message, 'auth', action);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for network/connectivity failures.
 */
export class NetworkError extends AppError {
  public readonly isOffline: boolean;

  constructor(message: string, isOffline = false) {
    super(message, 'network', undefined, { isOffline });
    this.name = 'NetworkError';
    this.isOffline = isOffline;
  }
}

/**
 * Error for sync/mutation-queue failures.
 */
export class SyncError extends AppError {
  public readonly tournamentId?: string;

  constructor(message: string, tournamentId?: string) {
    super(message, 'sync', undefined, tournamentId ? { tournamentId } : undefined);
    this.name = 'SyncError';
    this.tournamentId = tournamentId;
  }
}

// =============================================================================
// OptimisticLockError (existing, unchanged)
// =============================================================================

/**
 * Error thrown when an optimistic locking conflict occurs.
 * This happens when trying to save a version of data that is older than what is on the server.
 *
 * Supports two use cases:
 * 1. Match-level conflicts: new OptimisticLockError(matchId, expectedVersion, actualVersion)
 * 2. General conflicts: new OptimisticLockError('Custom message')
 *
 * For match conflicts, contains rich context for debugging and UI feedback:
 * - matchId: Which match had the conflict
 * - expectedVersion: The version we tried to save
 * - actualVersion: The current version in the database
 */
export class OptimisticLockError extends Error {
  public readonly matchId?: string;
  public readonly expectedVersion?: number;
  public readonly actualVersion?: number;

  /**
   * Create an OptimisticLockError.
   *
   * @param matchIdOrMessage - Either matchId (for match conflicts) or a custom error message
   * @param expectedVersion - Optional: The version we tried to save
   * @param actualVersion - Optional: The current version in the database
   */
  constructor(matchIdOrMessage: string, expectedVersion?: number, actualVersion?: number) {
    // If version parameters are provided, this is a match-level conflict
    if (expectedVersion !== undefined && actualVersion !== undefined) {
      super(
        `Optimistic lock failed: Match ${matchIdOrMessage} was modified ` +
          `(expected v${expectedVersion}, got v${actualVersion})`
      );
      this.matchId = matchIdOrMessage;
      this.expectedVersion = expectedVersion;
      this.actualVersion = actualVersion;
    } else {
      // General conflict with custom message
      super(matchIdOrMessage);
      this.matchId = undefined;
      this.expectedVersion = undefined;
      this.actualVersion = undefined;
    }
    this.name = 'OptimisticLockError';
  }

  /**
   * Check if this is a match-level conflict with rich context
   */
  isMatchConflict(): boolean {
    return this.matchId !== undefined;
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Message patterns that mark a mutation-queue error as a transient network
 * failure. Kept as an explicit list (not just a generic /fetch/i) because the
 * real error text reaching `isTransientMutationError` differs per browser —
 * verified against `@supabase/postgrest-js`'s actual (non-throwing) error
 * shape, see the function doc below:
 * - Chrome:  "TypeError: Failed to fetch"
 * - Firefox: "TypeError: NetworkError when attempting to fetch resource."
 * - Safari/iOS: "TypeError: Load failed" — the iPad/iPhone cockpit wording,
 *   the actual target hardware for the captive-portal case this exists for.
 */
const TRANSIENT_NETWORK_MESSAGE_PATTERNS = [
  /fetch/i,
  /networkerror/i,
  /network error/i,
  /load failed/i,
  /timeout/i,
];

/**
 * Classifies an error thrown by a mutation-queue `execute()` call as
 * transient (should NOT count as a failed attempt — the item stays at the
 * head of the queue and is retried on the next process() call, without
 * touching retryCount) or permanent (counts as before, unchanged).
 *
 * Task A3 (minimal, see task-A3-brief.md): behind a captive portal (e.g. a
 * hall Wi-Fi login page), `navigator.onLine` reports true but every request
 * fails with a network error — those must not be counted as failed
 * attempts, or the queue silently dead-letters entries after MAX_RETRIES.
 *
 * IMPORTANT — the real error shape is NOT a raw thrown `TypeError`.
 * `SupabaseRepository` never calls `.throwOnError()`, so `postgrest-js`
 * catches a failing `fetch()` itself and returns a plain object
 * `{ message: "TypeError: <reason>", details, hint, code: '' }` with NO
 * `.name` field and NO `.status`. `SupabaseRepository` then wraps that as
 * `new RepositoryError(op, error.message, error)` — or, for
 * `updateMatch(es)` (the live-cockpit write path), one level deeper:
 * `errors.push(new Error(\`Match ${id}: ${error.message}\`))`, then
 * `new RepositoryError('updateMatches', errors.map(e => e.message).join('; '),
 * errors)`, where `originalError` is an ARRAY of `Error`, not a single
 * object. The message text (a substring of the original `${name}: ${message}`
 * postgrest built) is the one signal that survives every layer of wrapping —
 * classification here is deliberately message-first, and walks into
 * `originalError` whether it is a single object or an array, for cases where
 * the message alone was not propagated.
 *
 * Transient: network failures (fetch/TypeError, "Failed to fetch",
 * "NetworkError when attempting to fetch resource" (Firefox), "Load failed"
 * (Safari/iOS)), timeouts/aborts, HTTP 408, 429, 5xx.
 * Permanent (default — everything not positively recognised as transient):
 * RLS/403, other 4xx, Postgres error codes (23xxx, P0001, 22P02),
 * OptimisticLockError, etc. — exactly today's behaviour.
 *
 * Known gap (see task-A3-report.md „Bedenken"): `PostgrestError` never
 * carries an HTTP status (neither in the throw nor the non-throw path), and
 * `SupabaseRepository` does not copy one onto the errors it wraps. The
 * 408/429/5xx branch below is therefore unreachable today against a real
 * Supabase response — it only fires for a `status`/`statusCode` an `execute()`
 * caller sets explicitly (e.g. in tests, or a future caller).
 */
export function isTransientMutationError(error: unknown): boolean {
  if (error instanceof OptimisticLockError) {
    return false;
  }
  if (isAbortError(error)) {
    return true;
  }
  if (Array.isArray(error)) {
    // SupabaseRepository.updateMatches wraps per-match failures as
    // RepositoryError(..., errors: Error[]) — transient if ANY entry is.
    return error.some((e) => isTransientMutationError(e));
  }
  if (!error || typeof error !== 'object') {
    return false;
  }

  const e = error as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    originalError?: unknown;
  };

  const message = e.message ?? '';
  if (
    e.name === 'TypeError' ||
    TRANSIENT_NETWORK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
  ) {
    return true;
  }

  const status = e.status ?? e.statusCode;
  if (typeof status === 'number' && (status === 408 || status === 429 || (status >= 500 && status < 600))) {
    return true;
  }

  // RepositoryError wraps the raw Supabase/Postgrest error (or an array of
  // per-item Errors, for updateMatch/updateMatches) in originalError — the
  // transient signal may live there instead of on the wrapper's own message.
  if (e.originalError && typeof e.originalError === 'object' && e.originalError !== error) {
    return isTransientMutationError(e.originalError);
  }

  return false;
}

/**
 * Checks if an error is an AbortError (expected during navigation, StrictMode, unmount).
 * Consolidated from 3 duplicate implementations across the codebase.
 *
 * Handles:
 * - Standard AbortError (name === 'AbortError')
 * - DOMException abort (code 20)
 * - Message-based detection ('aborted', 'AbortError', 'Cloud fetch timeout')
 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as { name?: string; message?: string; code?: string | number };
  return (
    e.name === 'AbortError' ||
    (e.message?.includes('AbortError') ?? false) ||
    (e.message?.includes('aborted') ?? false) ||
    (e.message?.includes('Cloud fetch timeout') ?? false) ||
    e.code === '20' ||
    e.code === 20
  );
}
