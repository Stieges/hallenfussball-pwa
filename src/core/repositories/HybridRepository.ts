/**
 * HybridRepository - Offline-First Repository with Cloud Sync
 *
 * Combines LocalStorageRepository (for offline-first access) with
 * SupabaseRepository (for cloud persistence) and SyncService (for offline mutations).
 *
 * Strategy:
 * - READ: Local first, then sync from cloud if online
 * - WRITE: Always write local, queue for cloud sync if offline
 * - SYNC: Conflict resolution via ConflictResolver
 *
 * This repository provides a unified interface that "just works" regardless
 * of network state, while ensuring data consistency.
 */

import { ITournamentRepository } from './ITournamentRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { syncService } from '../sync/SyncService';
import { SyncOperation } from '../sync/types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { resolveTournamentConflict, requiresManualResolution } from '../sync/ConflictResolver';

/**
 * Options for HybridRepository behavior
 */
export interface HybridRepositoryOptions {
  /** Conflict resolution strategy for automatic merges */
  defaultConflictStrategy?: 'local' | 'remote' | 'merge';

  /** Whether to automatically sync on operations when online */
  autoSync?: boolean;

  /** Callback when a conflict requires manual resolution */
  onConflict?: (local: Tournament, remote: Tournament) => Promise<Tournament>;
}

/**
 * HybridRepository - Offline-first with cloud sync
 */
export class HybridRepository implements ITournamentRepository {
  private local: LocalStorageRepository;
  private remote: SupabaseRepository | null;
  private options: Required<HybridRepositoryOptions>;

  constructor(options: HybridRepositoryOptions = {}) {
    this.local = new LocalStorageRepository();
    this.remote = isSupabaseConfigured ? new SupabaseRepository() : null;
    this.options = {
      defaultConflictStrategy: options.defaultConflictStrategy ?? 'merge',
      autoSync: options.autoSync ?? true,
      onConflict: options.onConflict ?? (async (local) => local),
    };
  }

  /**
   * Check if we're online and have cloud access
   */
  private get isOnline(): boolean {
    return navigator.onLine && this.remote !== null;
  }

  /**
   * Get remote repository, throwing if not available
   * Use only after checking isOnline
   */
  private getRemote(): SupabaseRepository {
    if (!this.remote) {
      throw new Error('Remote repository not available');
    }
    return this.remote;
  }

  // =============================================================================
  // ITournamentRepository Implementation
  // =============================================================================

  /**
   * Get tournament by ID
   * - Online: Fetch from cloud, update local cache
   * - Offline: Use local cache
   */
  async get(id: string): Promise<Tournament | null> {
    // Always try local first for fast response
    const localTournament = await this.local.get(id);

    if (!this.isOnline) {
      return localTournament;
    }

    try {
      const remoteTournament = await this.getRemote().get(id);

      if (!remoteTournament) {
        // Not in cloud - might be local-only or deleted
        return localTournament;
      }

      if (!localTournament) {
        // Only in cloud - save locally
        await this.local.save(remoteTournament);
        return remoteTournament;
      }

      // Both exist - check for conflicts
      if (localTournament.version !== remoteTournament.version) {
        return this.resolveConflict(localTournament, remoteTournament);
      }

      return remoteTournament;
    } catch (error) {
      // Network error - fall back to local
      if (import.meta.env.DEV) {
        console.warn('Failed to fetch from cloud, using local:', error);
      }
      return localTournament;
    }
  }

  /**
   * Get tournament by share code (cloud-only feature)
   * Falls back to null if offline
   */
  async getByShareCode(code: string): Promise<Tournament | null> {
    if (!this.isOnline) {
      return null;
    }

    try {
      const tournament = await this.getRemote().getByShareCode(code);
      if (tournament) {
        // Cache locally for offline access
        await this.local.save(tournament);
      }
      return tournament;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to fetch by share code:', error);
      }
      return null;
    }
  }

  /**
   * Save tournament
   * - Always saves locally first
   * - Queues cloud sync if offline, syncs immediately if online
   */
  async save(tournament: Tournament): Promise<void> {
    // Always save locally first (offline-first)
    await this.local.save(tournament);

    if (!this.isOnline) {
      // Queue for later sync
      await this.queueMutation('UPSERT', tournament.id, tournament);
      return;
    }

    if (this.options.autoSync) {
      try {
        await this.getRemote().save(tournament);
        // Update local version to match cloud
        await this.local.updateLocalVersion(tournament.id, (tournament.version ?? 0) + 1);
      } catch (error) {
        // Network error - queue for later
        if (import.meta.env.DEV) {
          console.warn('Failed to save to cloud, queuing:', error);
        }
        await this.queueMutation('UPSERT', tournament.id, tournament);
      }
    }
  }

  /**
   * Update a single match
   */
  async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
    return this.updateMatches(tournamentId, [update]);
  }

  /**
   * Update multiple matches
   * - Always updates locally first
   * - Queues cloud sync if offline
   */
  async updateMatches(
    tournamentId: string,
    updates: MatchUpdate[],
    baseVersion?: number
  ): Promise<void> {
    // Always update locally first
    await this.local.updateMatches(tournamentId, updates, baseVersion);

    if (!this.isOnline) {
      // Queue for later sync
      await this.queueMutation('UPDATE', tournamentId, { updates, baseVersion });
      return;
    }

    if (this.options.autoSync) {
      try {
        await this.getRemote().updateMatches(tournamentId, updates, baseVersion);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to update matches in cloud, queuing:', error);
        }
        await this.queueMutation('UPDATE', tournamentId, { updates, baseVersion });
      }
    }
  }

  /**
   * Delete tournament
   * - Deletes locally immediately
   * - Queues cloud deletion if offline
   */
  async delete(id: string): Promise<void> {
    // Delete locally first
    await this.local.delete(id);

    if (!this.isOnline) {
      await this.queueMutation('DELETE', id, { id });
      return;
    }

    if (this.options.autoSync) {
      try {
        await this.getRemote().delete(id);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to delete from cloud, queuing:', error);
        }
        await this.queueMutation('DELETE', id, { id });
      }
    }
  }

  /**
   * List tournaments for current user
   * - Online: Merge local and remote lists
   * - Offline: Local only
   */
  async listForCurrentUser(): Promise<Tournament[]> {
    const localList = await this.local.listForCurrentUser();

    if (!this.isOnline) {
      return localList;
    }

    try {
      const remoteList = await this.getRemote().listForCurrentUser();

      // Merge lists: remote is source of truth for cloud tournaments,
      // but local may have unsynced tournaments
      return this.mergeTournamentLists(localList, remoteList);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to fetch from cloud, using local:', error);
      }
      return localList;
    }
  }

  // =============================================================================
  // Extended Methods (Archive/Restore)
  // =============================================================================

  /**
   * Archive (soft delete) a tournament
   * Sets deletedAt timestamp without removing data
   */
  async archive(id: string): Promise<void> {
    const tournament = await this.local.get(id);
    if (!tournament) {
      throw new Error(`Tournament ${id} not found`);
    }

    const archivedTournament: Tournament = {
      ...tournament,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (tournament.version ?? 0) + 1,
    };

    await this.local.save(archivedTournament);

    if (this.isOnline && this.options.autoSync) {
      try {
        // SupabaseRepository has softDelete method
        await this.getRemote().softDelete(id);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to archive in cloud, queuing:', error);
        }
        await this.queueMutation('UPDATE', id, { deletedAt: archivedTournament.deletedAt });
      }
    } else if (!this.isOnline) {
      await this.queueMutation('UPDATE', id, { deletedAt: archivedTournament.deletedAt });
    }
  }

  /**
   * Restore an archived tournament
   * Clears deletedAt timestamp
   */
  async restore(id: string): Promise<void> {
    const tournament = await this.local.get(id);
    if (!tournament) {
      throw new Error(`Tournament ${id} not found`);
    }

    const restoredTournament: Tournament = {
      ...tournament,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
      version: (tournament.version ?? 0) + 1,
    };

    await this.local.save(restoredTournament);

    if (this.isOnline && this.options.autoSync) {
      try {
        await this.getRemote().restore(id);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to restore in cloud, queuing:', error);
        }
        await this.queueMutation('UPDATE', id, { deletedAt: null });
      }
    } else if (!this.isOnline) {
      await this.queueMutation('UPDATE', id, { deletedAt: null });
    }
  }

  // =============================================================================
  // Sync Methods
  // =============================================================================

  /**
   * Force sync all pending mutations to cloud
   */
  async syncUp(): Promise<void> {
    await syncService.processQueue();
  }

  /**
   * Sync a specific tournament from cloud
   */
  async syncTournament(id: string): Promise<Tournament | null> {
    if (!this.isOnline) {
      return this.local.get(id);
    }

    try {
      const remote = await this.getRemote().get(id);
      if (!remote) {
        return null;
      }

      const local = await this.local.get(id);
      if (local) {
        const resolved = await this.resolveConflict(local, remote);
        await this.local.save(resolved);
        return resolved;
      }

      await this.local.save(remote);
      return remote;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Sync failed:', error);
      }
      return this.local.get(id);
    }
  }

  /**
   * Sync all tournaments from cloud
   */
  async syncAll(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    try {
      const remoteList = await this.getRemote().listForCurrentUser();

      for (const remote of remoteList) {
        const local = await this.local.get(remote.id);
        if (local) {
          const resolved = await this.resolveConflict(local, remote);
          await this.local.save(resolved);
        } else {
          await this.local.save(remote);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Sync all failed:', error);
      }
    }
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  /**
   * Queue a mutation for offline sync
   */
  private async queueMutation(
    operation: SyncOperation,
    recordId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await syncService.enqueueOfflineMutation({
      table: 'tournaments',
      operation,
      recordId,
      payload,
    });
  }

  /**
   * Resolve conflicts between local and remote versions
   */
  private async resolveConflict(
    local: Tournament,
    remote: Tournament
  ): Promise<Tournament> {
    // Check if manual resolution is required
    if (requiresManualResolution(local, remote)) {
      // Call user-provided conflict handler
      return this.options.onConflict(local, remote);
    }

    // Auto-resolve using configured strategy
    const result = resolveTournamentConflict(
      local,
      remote,
      this.options.defaultConflictStrategy
    );

    // Emit conflict event for UI notification
    if (result.hadConflict) {
      syncService.emit('conflict', {
        localVersion: local,
        remoteVersion: remote,
        conflictType: 'update',
        timestamp: new Date(),
      });
    }

    return result.resolved;
  }

  /**
   * Merge local and remote tournament lists
   * Remote is source of truth, but preserves local-only tournaments
   */
  private mergeTournamentLists(
    localList: Tournament[],
    remoteList: Tournament[]
  ): Tournament[] {
    const remoteIds = new Set(remoteList.map((t) => t.id));
    const result = [...remoteList];

    // Add local-only tournaments (unsynced)
    for (const local of localList) {
      if (!remoteIds.has(local.id)) {
        // Mark as unsynced for UI indication
        result.push({
          ...local,
          _unsynced: true,
        } as Tournament & { _unsynced: boolean });
      }
    }

    // Sort by updatedAt descending
    return result.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }
}

/**
 * Default hybrid repository instance
 */
export const hybridRepository = new HybridRepository();
