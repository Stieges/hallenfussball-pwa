
/**
 * Error thrown when an optimistic locking conflict occurs.
 * This happens when trying to save a version of data that is older than what is on the server.
 */
export class OptimisticLockError extends Error {
    constructor(message: string = 'Conflict: The data has been modified by another user.') {
        super(message);
        this.name = 'OptimisticLockError';
    }
}
