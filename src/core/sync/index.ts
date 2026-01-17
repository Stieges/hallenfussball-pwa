/**
 * Sync Module - Offline-First Synchronization Infrastructure
 *
 * Provides:
 * - SyncQueueStore: IndexedDB-based mutation queue
 * - ConflictResolver: Handles sync conflicts between local/remote
 * - SyncService: Orchestrates sync operations
 *
 * Usage:
 * ```typescript
 * import { syncService, SyncStatus } from '@/core/sync';
 *
 * // Listen for status changes
 * syncService.on('statusChange', (status: SyncStatus) => {
 *   console.log('Pending:', status.pendingCount);
 * });
 *
 * // Enqueue offline mutation
 * await syncService.enqueueOfflineMutation({
 *   table: 'tournaments',
 *   operation: 'UPDATE',
 *   recordId: tournament.id,
 *   payload: tournament,
 * });
 * ```
 */

// Types
export * from './types';

// SyncQueueStore
export {
  SyncQueueStore,
  syncQueueStore,
  createTournamentMutation,
  createMatchMutation,
  type ISyncQueueStore,
} from './SyncQueueStore';

// ConflictResolver
export {
  resolveTournamentConflict,
  resolveMatchConflict,
  createSyncConflict,
  requiresManualResolution,
  describeConflict,
  type ConflictResult,
} from './ConflictResolver';

// SyncService
export {
  SyncService,
  syncService,
  type SyncServiceConfig,
  type SyncEventType,
} from './SyncService';
