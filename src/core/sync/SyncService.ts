/**
 * SyncService - Offline-First Synchronization
 *
 * Handles synchronization between local IndexedDB and Supabase cloud.
 * Implements offline-first pattern with queue-based mutations.
 *
 * Architecture:
 * - Mutations are queued locally when offline
 * - Queue is processed when online (FIFO order)
 * - Conflicts are detected and emitted for UI handling
 * - Automatic retry with exponential backoff
 *
 * Event-driven architecture:
 * - 'conflict': Emitted when sync conflict detected
 * - 'syncStart': Emitted when queue processing starts
 * - 'syncComplete': Emitted when queue processing completes
 * - 'syncError': Emitted on sync errors
 * - 'statusChange': Emitted when online/offline status changes
 */

import { Tournament } from '../../types/tournament';
import {
  SyncConflict,
  SyncResult,
  ConflictResolutionStrategy,
  QueuedMutation,
  SyncQueueResult,
  SyncStatus,
} from './types';
import { syncQueueStore, ISyncQueueStore } from './SyncQueueStore';
import {
  resolveTournamentConflict,
  createSyncConflict,
  requiresManualResolution,
} from './ConflictResolver';

// Event types for the SyncService
export type SyncEventType = 'conflict' | 'syncStart' | 'syncComplete' | 'syncError' | 'statusChange';

type ConflictHandler = (conflict: SyncConflict) => void;
type SyncStartHandler = () => void;
type SyncCompleteHandler = (result: SyncQueueResult) => void;
type SyncErrorHandler = (error: Error) => void;
type StatusChangeHandler = (status: SyncStatus) => void;

type EventHandler =
  | ConflictHandler
  | SyncStartHandler
  | SyncCompleteHandler
  | SyncErrorHandler
  | StatusChangeHandler;

/**
 * Configuration for the SyncService
 */
export interface SyncServiceConfig {
  /** Minimum delay between sync attempts in ms (default: 1000) */
  minRetryDelay?: number;
  /** Maximum delay between sync attempts in ms (default: 30000) */
  maxRetryDelay?: number;
  /** Number of retries before giving up on a mutation (default: 5) */
  maxRetries?: number;
  /** Auto-process queue when online (default: true) */
  autoProcessOnOnline?: boolean;
}

const DEFAULT_CONFIG: Required<SyncServiceConfig> = {
  minRetryDelay: 1000,
  maxRetryDelay: 30000,
  maxRetries: 5,
  autoProcessOnOnline: true,
};

export class SyncService {
  private eventListeners = new Map<SyncEventType, EventHandler[]>();
  private queueStore: ISyncQueueStore;
  private config: Required<SyncServiceConfig>;
  private isProcessing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncAt: Date | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(
    queueStore: ISyncQueueStore = syncQueueStore,
    config: SyncServiceConfig = {}
  ) {
    this.queueStore = queueStore;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Setup online/offline listeners
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => this.handleOnline();
      this.offlineHandler = () => this.handleOffline();

      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
      }
      if (this.offlineHandler) {
        window.removeEventListener('offline', this.offlineHandler);
      }
    }
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Register event listener
   */
  on(event: 'conflict', handler: ConflictHandler): void;
  on(event: 'syncStart', handler: SyncStartHandler): void;
  on(event: 'syncComplete', handler: SyncCompleteHandler): void;
  on(event: 'syncError', handler: SyncErrorHandler): void;
  on(event: 'statusChange', handler: StatusChangeHandler): void;
  on(event: SyncEventType, handler: EventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.push(handler);
    }
  }

  /**
   * Unregister event listener
   */
  off(event: SyncEventType, handler: EventHandler): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all registered listeners
   */
  private emit(event: 'conflict', data: SyncConflict): void;
  private emit(event: 'syncStart'): void;
  private emit(event: 'syncComplete', data: SyncQueueResult): void;
  private emit(event: 'syncError', data: Error): void;
  private emit(event: 'statusChange', data: SyncStatus): void;
  private emit(
    event: SyncEventType,
    data?: SyncConflict | SyncQueueResult | Error | SyncStatus
  ): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        if (data !== undefined) {
          (handler as (data: unknown) => void)(data);
        } else {
          (handler as () => void)();
        }
      });
    }
  }

  // ============================================================================
  // Online/Offline Handling
  // ============================================================================

  private handleOnline(): void {
    this.isOnline = true;
    this.emitStatusChange();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Online - processing queue');
    }

    if (this.config.autoProcessOnOnline) {
      void this.processQueue();
    }
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.emitStatusChange();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Offline - mutations will be queued');
    }
  }

  private emitStatusChange(): void {
    void this.getStatus().then((status) => {
      this.emit('statusChange', status);
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    const pendingCount = await this.queueStore.getQueueSize();
    return {
      pendingCount,
      isProcessing: this.isProcessing,
      lastSyncAt: this.lastSyncAt,
      isOnline: this.isOnline,
    };
  }

  /**
   * Enqueue a mutation for offline sync
   * Call this instead of direct API calls when making changes
   */
  async enqueueOfflineMutation(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retries' | 'status'>
  ): Promise<string> {
    const id = await this.queueStore.enqueue(mutation);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[SyncService] Enqueued mutation: ${mutation.operation} on ${mutation.table}`);
    }

    this.emitStatusChange();

    // If online, try to process immediately
    if (this.isOnline && !this.isProcessing) {
      void this.processQueue();
    }

    return id;
  }

  /**
   * Process all pending mutations in the queue
   * Called automatically when coming online, or manually
   */
  async processQueue(): Promise<SyncQueueResult> {
    if (this.isProcessing) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[SyncService] Already processing queue');
      }
      return { success: 0, failed: 0, conflicts: [] };
    }

    if (!this.isOnline) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[SyncService] Offline - cannot process queue');
      }
      return { success: 0, failed: 0, conflicts: [] };
    }

    this.isProcessing = true;
    this.emit('syncStart');

    const result: SyncQueueResult = {
      success: 0,
      failed: 0,
      conflicts: [],
    };

    try {
      // Get all pending mutations
      const pending = await this.queueStore.peek();

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(`[SyncService] Processing ${pending.length} mutations`);
      }

      for (const mutation of pending) {
        try {
          await this.queueStore.markProcessing(mutation.id);
          const syncResult = await this.processMutation(mutation);

          if (syncResult.status === 'success') {
            await this.queueStore.remove(mutation.id);
            result.success++;
          } else if (syncResult.status === 'conflict') {
            result.conflicts.push(syncResult.conflict);
            this.emit('conflict', syncResult.conflict);
            // Don't remove - keep in queue for manual resolution
          } else {
            await this.queueStore.markFailed(mutation.id, syncResult.error);
            result.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.queueStore.markFailed(mutation.id, errorMessage);
          result.failed++;

          if (import.meta.env.DEV) {
            console.error(`[SyncService] Mutation ${mutation.id} failed:`, error);
          }
        }
      }

      this.lastSyncAt = new Date();
      this.emit('syncComplete', result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown sync error');
      this.emit('syncError', err);

      if (import.meta.env.DEV) {
        console.error('[SyncService] Queue processing failed:', error);
      }
    } finally {
      this.isProcessing = false;
      this.emitStatusChange();
    }

    return result;
  }

  /**
   * Process a single mutation
   * This is where the actual API calls would happen
   */
  private async processMutation(mutation: QueuedMutation): Promise<SyncResult> {
    // TODO: Replace with actual Supabase API calls
    // For now, simulate success after a small delay

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        `[SyncService] Processing: ${mutation.operation} ${mutation.table}/${mutation.recordId}`
      );
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // For now, always succeed
    // In real implementation, this would:
    // 1. Send mutation to Supabase
    // 2. Check for conflicts (version mismatch)
    // 3. Return appropriate result

    return { status: 'success' };
  }

  /**
   * Sync a specific tournament
   * Fetches from remote and compares with local
   */
  async syncTournament(tournamentId: string): Promise<SyncResult> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[SyncService] syncTournament called for ${tournamentId}`);
    }

    if (!this.isOnline) {
      return { status: 'error', error: 'Offline - cannot sync' };
    }

    // TODO: Implement actual sync logic
    // 1. Fetch remote version from Supabase
    // 2. Compare with local version
    // 3. If conflict, emit event and return conflict
    // 4. If no conflict, update local and return success

    return { status: 'success' };
  }

  /**
   * Resolve a sync conflict using specified strategy
   */
  async resolveConflict(
    conflict: SyncConflict,
    strategy: ConflictResolutionStrategy
  ): Promise<void> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[SyncService] Resolving conflict with strategy: ${strategy}`);
    }

    const result = resolveTournamentConflict(
      conflict.localVersion,
      conflict.remoteVersion,
      strategy
    );

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Conflict resolved:', {
        hadConflict: result.hadConflict,
        strategy: result.strategy,
        mergedFields: result.mergedFields,
      });
    }

    // TODO: Write resolved tournament to both local and remote storage
    // 1. Update local IndexedDB
    // 2. Push to Supabase with incremented version
    // 3. Remove any related pending mutations from queue

    // For now, just log the resolved tournament
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Resolved tournament:', result.resolved.id);
    }
  }

  /**
   * Check if a conflict requires manual resolution
   */
  requiresManualResolution(local: Tournament, remote: Tournament): boolean {
    return requiresManualResolution(local, remote);
  }

  /**
   * Create a SyncConflict object for a detected conflict
   */
  createConflict(
    local: Tournament,
    remote: Tournament,
    type: 'update' | 'delete' = 'update'
  ): SyncConflict {
    return createSyncConflict(local, remote, type);
  }

  /**
   * Get all failed mutations for display/retry
   */
  async getFailedMutations(): Promise<QueuedMutation[]> {
    return this.queueStore.getFailedMutations();
  }

  /**
   * Retry a specific failed mutation
   */
  async retryMutation(mutationId: string): Promise<void> {
    await this.queueStore.retryFailed(mutationId);
    this.emitStatusChange();

    // Try to process if online
    if (this.isOnline && !this.isProcessing) {
      void this.processQueue();
    }
  }

  /**
   * Clear all pending mutations (use with caution!)
   */
  async clearQueue(): Promise<void> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Clearing all pending mutations');
    }
    await this.queueStore.clear();
    this.emitStatusChange();
  }
}

/**
 * Singleton instance for app-wide sync service
 */
export const syncService = new SyncService();
