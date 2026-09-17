
import { z } from 'zod';
import { generateUniqueId } from '../../utils/idGenerator';
import { safeLocalStorage } from '../utils/safeStorage';
import { captureFeatureError } from '../../lib/sentry';

/**
 * Structural (not enum-restricted) validation for a queued mutation item.
 *
 * The tournament queue's original schema (MutationItemSchema) restricted
 * `type` to a fixed enum of tournament mutation types. That restriction is
 * tournament-specific business logic, not shared machinery, so it does not
 * belong here — hard-coding it into the generic class would silently drop
 * every item for any other TType union (e.g. a future Tournament-Series
 * queue) at load time. This schema validates the same shape without
 * constraining `type` to a specific set of literals; for every value that
 * was ever valid under the old enum-restricted schema, validation outcome
 * is unchanged.
 */
const GenericMutationItemSchema = z.object({
    id: z.string(),
    type: z.string(),
    payload: z.unknown(),
    timestamp: z.number(),
    retryCount: z.number(),
});

const GenericFailedMutationItemSchema = GenericMutationItemSchema.extend({
    failedAt: z.number(),
    lastError: z.string().optional(),
});

/**
 * A requested change to be persisted to the cloud, generic over the
 * consumer's mutation-type union.
 */
export interface GenericMutationItem<TType extends string> {
    id: string;
    type: TType;
    payload: unknown;
    timestamp: number;
    retryCount: number;
}

export const MAX_RETRIES = 5;

/**
 * A mutation that failed permanently (exceeded max retries)
 */
export interface FailedMutationItem<TType extends string = string> extends GenericMutationItem<TType> {
    failedAt: number;
    lastError?: string;
}

/**
 * Status info for subscribers
 */
export interface MutationQueueStatus {
    pendingCount: number;
    failedCount: number;
}

/**
 * Configuration for a GenericMutationQueue instance. Everything that used to
 * be hard-wired to tournaments (storage keys, the executor switch, the
 * coalesce rules, the Sentry feature tag) is injected here.
 */
export interface MutationQueueConfig<TType extends string> {
    storageKey: string;
    failedStorageKey: string;
    /** Führt eine Mutation gegen das Remote aus; wirft bei Fehler (Retry-Semantik der Queue). */
    execute: (item: GenericMutationItem<TType>) => Promise<void>;
    /** Coalesce-Schlüssel oder null (kein Coalescing) — Semantik wie Bestand. */
    coalesceKey: (type: TType, payload: unknown) => string | null;
    /** Sentry-Feature-Tag (Bestand: 'sync'). */
    sentryFeature: string;
    /**
     * Optional guard restricting which `type` values are accepted at load.
     * An item whose type fails this check is rejected exactly like a
     * schema-invalid item (filtered out, same Sentry/logging path) — it
     * never enters the queue. This exists because an unrecognized type that
     * *does* enter the queue can sit at the head and head-of-line-block
     * every mutation behind it for up to MAX_RETRIES processing cycles
     * (process() intentionally `break`s, not `continue`s, on a non-final
     * retry failure, to preserve ordering for genuine transient failures).
     *
     * When omitted, every structurally-valid item is accepted (today's
     * default for a consumer that doesn't need this — e.g. a future
     * Tournament-Series queue that hasn't opted in yet).
     */
    isKnownType?: (type: string) => boolean;
}

/**
 * Offline-first mutation queue machinery: persists to localStorage, retries
 * with exponential backoff via MAX_RETRIES, coalesces duplicate mutations,
 * dead-letters permanently failing items, validates on load with Zod, and
 * notifies subscribers of status changes.
 *
 * Tournament-specific behaviour (mutation types, executor, coalesce rules,
 * storage keys) is injected via MutationQueueConfig — see MutationQueue.ts
 * for the tournament specialization.
 */
export class GenericMutationQueue<TType extends string> {
    private queue: GenericMutationItem<TType>[] = [];
    private failedQueue: FailedMutationItem<TType>[] = [];
    private isProcessing = false;
    private listeners: ((status: MutationQueueStatus) => void)[] = [];

    constructor(private config: MutationQueueConfig<TType>) {
        this.load();
        this.loadFailed();

        // Auto-process on online
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                // eslint-disable-next-line no-console
                if (import.meta.env.DEV) { console.log('MutationQueue: Online detected, processing queue...'); }
                void this.process();
            });

            // Try processing on start if online
            if (navigator.onLine) {
                void this.process();
            }
        }
    }

    /**
     * Add a mutation to the queue and persist it.
     * Triggers processing immediately if online.
     *
     * COALESCING: For certain mutation types, existing pending mutations
     * for the same entity will be replaced instead of duplicated.
     * This prevents queue bloat during rapid updates (e.g., team renaming).
     */
    public enqueue(type: TType, payload: unknown): void {
        // Try to coalesce with existing mutation
        const coalesceKey = this.config.coalesceKey(type, payload);
        if (coalesceKey) {
            const existingIndex = this.queue.findIndex(
                item => this.config.coalesceKey(item.type, item.payload) === coalesceKey
            );

            if (existingIndex !== -1) {
                // Replace existing mutation with newer payload
                this.queue[existingIndex] = {
                    ...this.queue[existingIndex],
                    payload,
                    timestamp: Date.now(),
                    // Keep retryCount from existing item (don't reset on coalesce)
                };
                this.save();
                this.notifyListeners();

                if (import.meta.env.DEV) {
                    // eslint-disable-next-line no-console
                    console.log(`MutationQueue: Coalesced ${type} for ${coalesceKey}`);
                }

                // Still trigger processing
                if (navigator.onLine) {
                    void this.process();
                }
                return;
            }
        }

        // No coalescing possible - add new item
        const item: GenericMutationItem<TType> = {
            id: generateUniqueId(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.queue.push(item);
        this.save();
        this.notifyListeners();

        // Optimistic processing
        if (navigator.onLine) {
            void this.process();
        }
    }

    public getPendingCount(): number {
        return this.queue.length;
    }

    public getFailedCount(): number {
        return this.failedQueue.length;
    }

    public getFailedMutations(): FailedMutationItem<TType>[] {
        return [...this.failedQueue];
    }

    public getStatus(): MutationQueueStatus {
        return {
            pendingCount: this.queue.length,
            failedCount: this.failedQueue.length,
        };
    }

    public subscribe(listener: (status: MutationQueueStatus) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.getStatus()));
    }

    /**
     * Move a failed mutation to the dead-letter queue
     */
    private moveToDeadLetter(item: GenericMutationItem<TType>, error?: string): void {
        const failedItem: FailedMutationItem<TType> = {
            ...item,
            failedAt: Date.now(),
            lastError: error,
        };
        this.failedQueue.push(failedItem);
        this.saveFailed();
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Moved ${item.id} to dead-letter queue`); }
    }

    /**
     * Retry a specific failed mutation
     * Moves it back to the regular queue for processing
     */
    public retryFailedMutation(id: string): boolean {
        const index = this.failedQueue.findIndex(item => item.id === id);
        if (index === -1) {
            return false;
        }

        const [failedItem] = this.failedQueue.splice(index, 1);
        this.saveFailed();

        // Reset retry count and re-enqueue
        const retriedItem: GenericMutationItem<TType> = {
            id: failedItem.id,
            type: failedItem.type,
            payload: failedItem.payload,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.queue.push(retriedItem);
        this.save();
        this.notifyListeners();

        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Retrying failed mutation ${id}`); }

        // Try to process immediately
        if (navigator.onLine) {
            void this.process();
        }

        return true;
    }

    /**
     * Retry all failed mutations
     */
    public retryAllFailed(): number {
        const count = this.failedQueue.length;
        if (count === 0) {
            return 0;
        }

        // Move all failed items back to main queue
        for (const failedItem of this.failedQueue) {
            const retriedItem: GenericMutationItem<TType> = {
                id: failedItem.id,
                type: failedItem.type,
                payload: failedItem.payload,
                timestamp: Date.now(),
                retryCount: 0,
            };
            this.queue.push(retriedItem);
        }

        this.failedQueue = [];
        this.saveFailed();
        this.save();
        this.notifyListeners();

        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) { console.log(`MutationQueue: Retrying ${count} failed mutations`); }

        // Try to process immediately
        if (navigator.onLine) {
            void this.process();
        }

        return count;
    }

    /**
     * Clear a specific failed mutation (discard it permanently)
     */
    public clearFailedMutation(id: string): boolean {
        const index = this.failedQueue.findIndex(item => item.id === id);
        if (index === -1) {
            return false;
        }

        this.failedQueue.splice(index, 1);
        this.saveFailed();
        this.notifyListeners();
        return true;
    }

    /**
     * Clear all failed mutations
     */
    public clearAllFailed(): number {
        const count = this.failedQueue.length;
        this.failedQueue = [];
        this.saveFailed();
        this.notifyListeners();
        return count;
    }

    private load() {
        try {
            const raw = safeLocalStorage.getItem(this.config.storageKey);
            if (raw) {
                const parsed: unknown[] = JSON.parse(raw) as unknown[];
                this.queue = parsed.filter((item) => {
                    const result = GenericMutationItemSchema.safeParse(item);
                    if (!result.success) {
                        captureFeatureError(
                            new Error(`Invalid mutation item in queue: ${result.error.message}`),
                            this.config.sentryFeature, 'loadQueue:validation'
                        );
                        return false;
                    }
                    if (this.config.isKnownType && !this.config.isKnownType(result.data.type)) {
                        captureFeatureError(
                            new Error(`Invalid mutation item in queue: unknown type "${result.data.type}"`),
                            this.config.sentryFeature, 'loadQueue:validation'
                        );
                        return false;
                    }
                    return true;
                }) as GenericMutationItem<TType>[];
            }
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to load queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'loadQueue'); }
            this.queue = [];
        }
    }

    private save() {
        try {
            safeLocalStorage.setItem(this.config.storageKey, JSON.stringify(this.queue));
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to save queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'saveQueue'); }
        }
    }

    private loadFailed() {
        try {
            const raw = safeLocalStorage.getItem(this.config.failedStorageKey);
            if (raw) {
                const parsed: unknown[] = JSON.parse(raw) as unknown[];
                this.failedQueue = parsed.filter((item) => {
                    const result = GenericFailedMutationItemSchema.safeParse(item);
                    if (!result.success) {
                        captureFeatureError(
                            new Error(`Invalid failed mutation item: ${result.error.message}`),
                            this.config.sentryFeature, 'loadFailedQueue:validation'
                        );
                        return false;
                    }
                    if (this.config.isKnownType && !this.config.isKnownType(result.data.type)) {
                        captureFeatureError(
                            new Error(`Invalid failed mutation item: unknown type "${result.data.type}"`),
                            this.config.sentryFeature, 'loadFailedQueue:validation'
                        );
                        return false;
                    }
                    return true;
                }) as FailedMutationItem<TType>[];
            }
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to load failed queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'loadFailedQueue'); }
            this.failedQueue = [];
        }
    }

    private saveFailed() {
        try {
            safeLocalStorage.setItem(this.config.failedStorageKey, JSON.stringify(this.failedQueue));
        } catch (e) {
            if (import.meta.env.DEV) { console.error('MutationQueue: Failed to save failed queue', e); }
            if (e instanceof Error) { captureFeatureError(e, this.config.sentryFeature, 'saveFailedQueue'); }
        }
    }

    /**
     * Process the queue sequentially.
     * Stops on error (preserving order) unless max retries exceeded.
     */
    public async process(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) { return; }
        if (!(navigator.onLine)) { return; }

        this.isProcessing = true;

        try {
            // Process head of queue
            while (this.queue.length > 0) {
                if (!(navigator.onLine)) { break; }

                const item = this.queue[0]; // Peek

                try {
                    await this.config.execute(item);
                } catch (error) {
                    if (import.meta.env.DEV) { console.warn(`MutationQueue: Error processing ${item.type} (${item.id})`, error); }

                    item.retryCount++;

                    if (item.retryCount >= MAX_RETRIES) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        if (import.meta.env.DEV) { console.error(`MutationQueue: Max retries exceeded for ${item.id}. Moving to dead-letter queue.`); }
                        if (error instanceof Error) { captureFeatureError(error, this.config.sentryFeature, 'deadLetter', { mutationType: item.type, mutationId: item.id }); }
                        // Move to dead-letter queue instead of dropping
                        this.queue.shift();
                        this.moveToDeadLetter(item, errorMessage);
                        this.save();
                        this.notifyListeners();
                        continue; // Continue to next item
                    } else {
                        // Keep in queue, stop processing for now (retry later)
                        this.save();
                        // break loop to retry later
                        break;
                    }
                }

                this.queue.shift(); // Remove handled item
                this.save();
                this.notifyListeners();
            }
        } finally {
            this.isProcessing = false;
        }
    }
}
