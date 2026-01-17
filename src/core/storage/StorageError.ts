/**
 * Custom error class for storage operations.
 * Allows distinguishing between storage failures and other errors.
 */
export class StorageError extends Error {
    constructor(message: string, public originalError?: unknown) {
        super(message);
        this.name = 'StorageError';
    }
}
