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
