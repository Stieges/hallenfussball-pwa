
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
    | 'UPDATE_MATCHES';

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
const MAX_RETRIES = 5;


export class MutationQueue {
    private queue: MutationItem[] = [];
    private isProcessing = false;
    private listeners: ((pendingCount: number) => void)[] = [];

    constructor(private supabaseRepo: SupabaseRepository) {
        this.load();

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

    public subscribe(listener: (pendingCount: number) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.queue.length));
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

    /**
     * Process the queue sequentially.
     * Stops on error (preserving order) unless max retries exceeded.
     */
    public async process(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) { return; }
        if (!(navigator.onLine as boolean)) { return; }

        this.isProcessing = true;

        try {
            // Process head of queue
            while (this.queue.length > 0) {
                if (!(navigator.onLine as boolean)) { break; }

                const item = this.queue[0]; // Peek


                try {
                    await this.executeMutation(item);
                } catch (error) {
                    console.warn(`MutationQueue: Error processing ${item.type} (${item.id})`, error);

                    item.retryCount++;

                    if (item.retryCount >= MAX_RETRIES) {
                        console.error(`MutationQueue: Max retries exceeded for ${item.id}. Dropping item.`);
                        // Move to dead letter queue? For now, we drop to unblock queue.
                        this.queue.shift();
                        this.save();
                        this.notifyListeners();
                        continue; // Continue to next item
                    } else {
                        // Keep in queue, stop processing for now (retry later)
                        // Wait a bit before retry? Or just exit loop to avoid spam loop?
                        // Let's exit loop and wait for next trigger/backoff.
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
            default:
                throw new Error(`Unknown mutation type: ${item.type as string}`);
        }
    }
}
