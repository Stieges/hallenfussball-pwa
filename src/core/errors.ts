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
