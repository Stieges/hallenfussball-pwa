/**
 * SyncService - P0-4 Task 4.3
 *
 * Handles synchronization between local and cloud storage.
 * Emits 'conflict' events when local and remote versions diverge.
 *
 * Event-driven architecture:
 * - Conflict detection during sync
 * - Event emission for UI handling
 * - Resolution strategies (local, remote, merge)
 */

import { Tournament } from '../../types/tournament';
import { SyncConflict, SyncResult, ConflictResolutionStrategy } from './types';

type EventHandler = (conflict: SyncConflict) => void;

export class SyncService {
  private eventListeners = new Map<string, EventHandler[]>();

  /**
   * Register event listener
   * @param event - Event name (currently only 'conflict')
   * @param handler - Event handler function
   */
  on(event: 'conflict', handler: EventHandler): void {
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
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off(event: 'conflict', handler: EventHandler): void {
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
   * @param event - Event name
   * @param data - Event data
   *
   * TODO (Task 4.3): Will be called from syncTournament() when conflicts are detected
   */
  // @ts-expect-error - Stub implementation, will be used in Task 4.3
  private emit(event: 'conflict', data: SyncConflict): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Sync a tournament between local and remote storage
   * @param tournamentId - ID of tournament to sync
   * @returns SyncResult indicating success, conflict, or error
   *
   * TODO: Implement actual sync logic with repositories
   * Currently stubbed for Task 4.2/4.4 integration
   */
  async syncTournament(tournamentId: string): Promise<SyncResult> {
    // Stub implementation - will be completed in Task 4.3
    // For now, return success to allow hook/app integration
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[SyncService] syncTournament called for ${tournamentId} (stub)`);
    }
    return { status: 'success' };
  }

  /**
   * Resolve a sync conflict using specified strategy
   * @param conflict - The conflict to resolve
   * @param strategy - Resolution strategy ('local', 'remote', or 'merge')
   *
   * Resolution strategies:
   * - 'local': Keep local version, overwrite remote
   * - 'remote': Keep remote version, overwrite local
   * - 'merge': Merge both versions (newest changes win)
   */
  async resolveConflict(
    conflict: SyncConflict,
    strategy: ConflictResolutionStrategy
  ): Promise<void> {
    // Stub implementation - will be completed in Task 4.3
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[SyncService] Resolving conflict with strategy: ${strategy}`);
    }

    let resolvedTournament: Tournament;

    switch (strategy) {
      case 'local':
        resolvedTournament = conflict.localVersion;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[SyncService] Keeping local version');
        }
        break;

      case 'remote':
        resolvedTournament = conflict.remoteVersion;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[SyncService] Keeping remote version');
        }
        break;

      case 'merge': {
        // Simple merge: prefer newer updatedAt
        const localTime = new Date(conflict.localVersion.updatedAt).getTime();
        const remoteTime = new Date(conflict.remoteVersion.updatedAt).getTime();
        resolvedTournament = localTime > remoteTime ? conflict.localVersion : conflict.remoteVersion;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[SyncService] Merged - using newer version');
        }
        break;
      }
    }

    // TODO: Actually write resolved tournament to both storages
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[SyncService] Conflict resolved (stub):', resolvedTournament.id);
    }
  }
}

/**
 * Singleton instance for app-wide sync service
 * Ensures single event emitter across the app
 */
export const syncService = new SyncService();
