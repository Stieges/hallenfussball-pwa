
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { generateUniqueId } from '../../utils/idGenerator';

/**
 * Supported mutation types
 */
export type MutationType =
    | 'SAVE_TOURNAMENT'
    | 'DELETE_TOURNAMENT'
    | 'UPDATE_MATCH'
    | 'UPDATE_MATCHES'
    | 'UPDATE_TOURNAMENT_METADATA';

/**
 * A requested change to be persisted to the cloud
 */
export interface MutationItem {
    id: string;
    type: MutationType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
    timestamp: number;
    retryCount: number;
}

const STORAGE_KEY = 'mutation_queue_v1';
const FAILED_STORAGE_KEY = 'mutation_queue_failed_v1';
const MAX_RETRIES = 5;

/**
 * A mutation that failed permanently (exceeded max retries)
 */
export interface FailedMutationItem extends MutationItem {
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


export class MutationQueue {
    private queue: MutationItem[] = [];
    private failedQueue: FailedMutationItem[] = [];
    private isProcessing = false;
    private listeners: ((status: MutationQueueStatus) => void)[] = [];

    constructor(private supabaseRepo: SupabaseRepository) {
        this.load();
        this.loadFailed();

        // Auto-process on online
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                // eslint-disable-next-line no-console
                console.log('MutationQueue: Online detected, processing queue...');
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
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public enqueue(type: MutationType, payload: any): void {
        const item: MutationItem = {
            id: generateUniqueId(),
            type,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    public getFailedMutations(): FailedMutationItem[] {
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
    private moveToDeadLetter(item: MutationItem, error?: string): void {
        const failedItem: FailedMutationItem = {
            ...item,
            failedAt: Date.now(),
            lastError: error,
        };
        this.failedQueue.push(failedItem);
        this.saveFailed();
        // eslint-disable-next-line no-console
        console.log(`MutationQueue: Moved ${item.id} to dead-letter queue`);
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
        const retriedItem: MutationItem = {
            id: failedItem.id,
            type: failedItem.type,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            payload: failedItem.payload,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.queue.push(retriedItem);
        this.save();
        this.notifyListeners();

        // eslint-disable-next-line no-console
        console.log(`MutationQueue: Retrying failed mutation ${id}`);

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
            const retriedItem: MutationItem = {
                id: failedItem.id,
                type: failedItem.type,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        console.log(`MutationQueue: Retrying ${count} failed mutations`);

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
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.queue = JSON.parse(raw) as MutationItem[];
            }
        } catch (e) {
            console.error('MutationQueue: Failed to load queue', e);
            this.queue = [];
        }
    }

    private save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('MutationQueue: Failed to save queue', e);
        }
    }

    private loadFailed() {
        try {
            const raw = localStorage.getItem(FAILED_STORAGE_KEY);
            if (raw) {
                this.failedQueue = JSON.parse(raw) as FailedMutationItem[];
            }
        } catch (e) {
            console.error('MutationQueue: Failed to load failed queue', e);
            this.failedQueue = [];
        }
    }

    private saveFailed() {
        try {
            localStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(this.failedQueue));
        } catch (e) {
            console.error('MutationQueue: Failed to save failed queue', e);
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
                    await this.executeMutation(item);
                } catch (error) {
                    console.warn(`MutationQueue: Error processing ${item.type} (${item.id})`, error);

                    item.retryCount++;

                    if (item.retryCount >= MAX_RETRIES) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        console.error(`MutationQueue: Max retries exceeded for ${item.id}. Moving to dead-letter queue.`);
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

    private async executeMutation(item: MutationItem): Promise<void> {
        switch (item.type) {
            case 'SAVE_TOURNAMENT':
                await this.supabaseRepo.save(item.payload as Tournament);
                break;
            case 'DELETE_TOURNAMENT':
                await this.supabaseRepo.delete(item.payload as string);
                break;
            case 'UPDATE_MATCH': {
                const { tournamentId, update } = item.payload as { tournamentId: string, update: MatchUpdate };
                await this.supabaseRepo.updateMatch(tournamentId, update);
                break;
            }
            case 'UPDATE_MATCHES': {
                const { tournamentId, updates } = item.payload as { tournamentId: string, updates: MatchUpdate[] };
                await this.supabaseRepo.updateMatches(tournamentId, updates);
                break;
            }
            case 'UPDATE_TOURNAMENT_METADATA': {
                const { tournamentId, metadata } = item.payload as { tournamentId: string, metadata: Partial<Tournament> };
                await this.supabaseRepo.updateTournamentMetadata(tournamentId, metadata);
                break;
            }
            default:
                throw new Error(`Unknown mutation type: ${item.type as string}`);
        }
    }
}
