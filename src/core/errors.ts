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
