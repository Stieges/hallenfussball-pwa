/**
 * Sync Types - Cloud Synchronization Infrastructure
 *
 * Part of P0-4: Conflict Resolution UI
 * Defines types for handling sync conflicts between local and cloud versions
 */

import { Tournament } from '../../types/tournament';

/**
 * Sync conflict between local and cloud versions
 * Occurs when both versions have been modified independently
 */
export interface SyncConflict {
  /** Local version of the tournament */
  localVersion: Tournament;

  /** Cloud/remote version of the tournament */
  remoteVersion: Tournament;

  /** Type of conflict that occurred */
  conflictType: 'update' | 'delete';

  /** Timestamp when conflict was detected */
  timestamp: Date;
}

/**
 * Result of a sync operation
 */
export type SyncResult =
  | { status: 'success' }
  | { status: 'conflict'; conflict: SyncConflict }
  | { status: 'error'; error: string };

/**
 * Strategy for resolving sync conflicts
 * - 'local': Keep the local version
 * - 'remote': Keep the cloud version
 * - 'merge': Attempt to merge both versions (newest changes win)
 */
export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge';

// ============================================================================
// Sync Queue Types (Phase 1: Offline-First)
// ============================================================================

/**
 * Tables that can be synced
 */
export type SyncTable = 'tournaments' | 'matches' | 'teams' | 'match_events';

/**
 * Operations that can be queued for sync
 */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';

/**
 * Status of a queued mutation
 */
export type MutationStatus = 'pending' | 'processing' | 'failed';

/**
 * A mutation queued for synchronization
 * Stored in IndexedDB and processed when online
 */
export interface QueuedMutation {
  /** Unique ID for this mutation (UUID) */
  id: string;

  /** Target table in Supabase */
  table: SyncTable;

  /** Type of operation */
  operation: SyncOperation;

  /** ID of the record being mutated */
  recordId: string;

  /** The data payload for INSERT/UPDATE operations */
  payload: Record<string, unknown>;

  /** When the mutation was created locally */
  createdAt: Date;

  /** Number of failed sync attempts */
  retries: number;

  /** Current status */
  status: MutationStatus;

  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Result of processing the sync queue
 */
export interface SyncQueueResult {
  /** Number of mutations successfully synced */
  success: number;

  /** Number of mutations that failed */
  failed: number;

  /** Mutations that resulted in conflicts */
  conflicts: SyncConflict[];
}

/**
 * Sync status for UI display
 */
export interface SyncStatus {
  /** Number of pending mutations */
  pendingCount: number;

  /** Whether sync is currently running */
  isProcessing: boolean;

  /** Last successful sync timestamp */
  lastSyncAt: Date | null;

  /** Whether device is online */
  isOnline: boolean;
}
