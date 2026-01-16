import { MutationQueue } from '../services/MutationQueue';
import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { LocalStorageRepository } from './LocalStorageRepository';
import { SupabaseRepository } from './SupabaseRepository';

// =============================================================================
// SYNC TYPES
// =============================================================================

export type SyncStatus = 'synced' | 'updated' | 'conflict' | 'error' | 'offline';

export interface SyncResult {
    status: SyncStatus;
    data?: Tournament;
    error?: string;
    conflicts?: SyncConflict[];
}

export interface SyncConflict {
    id: string;
    entityType: 'match' | 'tournament';
    entityId: string;
    entityName: string;
    field: string;
    localValue: unknown;
    remoteValue: unknown;
    localTimestamp: string;
    remoteTimestamp: string;
    remoteUser?: string;
}

export class OfflineRepository implements ITournamentRepository {
    private _mutationQueue: MutationQueue;

    constructor(
        private localRepo: LocalStorageRepository,
        private supabaseRepo: SupabaseRepository
    ) {
        this._mutationQueue = new MutationQueue(supabaseRepo);
    }

    /**
     * Get the mutation queue instance for status subscriptions
     */
    get mutationQueue(): MutationQueue {
        return this._mutationQueue;
    }

    /**
     * Tries to get from Supabase (Cloud).
     * If successful: Updates LocalStorage (Cache) and returns data.
     * If fails (Offline): Returns data from LocalStorage.
     */
    async get(id: string): Promise<Tournament | null> {
        try {
            // 1. Try Cloud
            const cloudData = await this.supabaseRepo.get(id);

            if (cloudData) {
                // 2. Update Cache
                await this.localRepo.save(cloudData);
                return cloudData;
            } else {
                return await this.localRepo.get(id);
            }
        } catch (error) {
            console.warn('OfflineRepository: Cloud fetch failed, falling back to local.', error);
            // 3. Fallback to Cache
            return await this.localRepo.get(id);
        }
    }

    async getByShareCode(code: string): Promise<Tournament | null> {
        // Share code lookups are primarily online
        try {
            return await this.supabaseRepo.getByShareCode(code);
        } catch (error) {
            console.warn('OfflineRepository: Cloud fetch by share code failed.', error);
            return null;
        }
    }

    /**
     * PERSISTENCE STRATEGY:
     * 1. Save Local (Optimistic UI)
     * 2. Enqueue Mutation (Persistent Background Sync)
     */
    async save(tournament: Tournament): Promise<void> {
        // 1. Save Local
        await this.localRepo.save(tournament);

        // 2. Enqueue Cloud Persistence
        this.mutationQueue.enqueue('SAVE_TOURNAMENT', tournament);
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        await this.localRepo.updateMatch(tournamentId, update);
        this.mutationQueue.enqueue('UPDATE_MATCH', { tournamentId, update });
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[], _baseVersion?: number): Promise<void> {
        await this.localRepo.updateMatches(tournamentId, updates);
        this.mutationQueue.enqueue('UPDATE_MATCHES', { tournamentId, updates });
    }

    async delete(id: string): Promise<void> {
        await this.localRepo.delete(id);
        this.mutationQueue.enqueue('DELETE_TOURNAMENT', id);
    }

    async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
        await this.localRepo.updateTournamentMetadata(id, metadata);
        this.mutationQueue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: id, metadata });
    }

    // --- Extended Methods for Sync ---

    /**
     * Lists tournaments.
     * Strategy:
     * - Try Cloud List + Merge with Local-only tournaments
     * - If fail: Return Local List.
     */
    async listForCurrentUser(): Promise<Tournament[]> {
        try {
            // Create a timeout promise (5s) to avoid hanging indefinitely if network is slow/flaky
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Cloud fetch timeout')), 5000)
            );

            // Race between cloud fetch and timeout
            const cloudList = await Promise.race([
                this.supabaseRepo.listForCurrentUser(),
                timeoutPromise
            ]);
            const localList = await this.localRepo.listForCurrentUser();

            // Merge: Add local-only tournaments that haven't been synced yet
            const cloudIds = new Set(cloudList.map(t => t.id));
            const localOnly = localList.filter(t => !cloudIds.has(t.id));

            // Return cloud list + unsynced local tournaments
            // Local-only items are marked so UI can show sync indicator if needed
            return [...cloudList, ...localOnly];
        } catch (error) {
            console.warn('OfflineRepository: Cloud list failed, returning local list.', error);
            // Fallback to all local tournaments
            return await this.localRepo.listForCurrentUser();
        }
    }

    /**
     * Trigger synchronization: Pushes local tournaments to cloud if missing/newer.
     */
    async syncUp(): Promise<void> {
        try {
            // Use public API to get local list
            const localList = await this.localRepo.listForCurrentUser();

            for (const localT of localList) {
                try {
                    // Try to get from cloud to check existence/version
                    const cloudT = await this.supabaseRepo.get(localT.id);

                    if (!cloudT) {
                        // Not in cloud -> Full Upload
                        await this.supabaseRepo.save(localT);
                        continue;
                    }

                    // Exists in cloud. Check versions/timestamps.
                    // Prefer version check if available
                    const localVer = localT.version ?? 0;
                    const cloudVer = cloudT.version ?? 0;

                    if (localVer > cloudVer) {
                        // Local is newer. Determine delta.
                        await this.syncTournamentDelta(localT, cloudT);
                    } else if (localVer === cloudVer) {
                        // Versions match. Check timestamps as fallback (legacy) or if version not used.
                        const localDate = new Date(localT.updatedAt).getTime();
                        const cloudDate = new Date(cloudT.updatedAt).getTime();
                        if (localDate > cloudDate) {
                            await this.syncTournamentDelta(localT, cloudT);
                        }
                    } else {
                        // Cloud is newer (localVer < cloudVer).
                        // syncUp is push-only. syncDown handles pull.
                        // We might want to warn or trigger syncDown?
                        // For now, do nothing.
                    }
                } catch (err) {
                    console.error(`Failed to sync tournament ${localT.id}`, err);
                }
            }
        } catch (error) {
            console.error('Sync up failed:', error);
        }
    }

    /**
     * Pushes changes from local to cloud using granular updates if possible.
     */
    private async syncTournamentDelta(local: Tournament, remote: Tournament): Promise<void> {
        // 1. Check for structural changes (requires full save)
        if (this.hasStructuralChanges(local, remote)) {
            // Be careful to pass the base version for optimistic locking
            // We want to update 'remote' to state of 'local'.
            // So base version is remote.version.
            // But 'local' might have higher version. 
            // We construct payload based on local, but with remote version as base?
            // save() takes 'tournament'. It extracts version from it.
            // If local.version = 5, remote.version = 4.
            // We want to update remote to 5.
            // SupabaseRepo.save(local) will check eq('version', local.version).
            // But local.version is 5. It will check eq('version', 5). Remote is 4. Fail.

            // Correct approach: We must update the record derived from remote.version.
            // But local has valid data with version 5.
            // If we blindly save(local), it checks version=5.
            // We temporarily set version=4 for the save call so it passes optimistic lock?
            // No, that sets new version to 5. Which matches local.
            await this.supabaseRepo.save({ ...local, version: remote.version });

            // Update local version explicitly to match the (single increment) result from save
            // remote.version (e.g. 4) -> save -> becomes 5.
            await this.localRepo.updateLocalVersion(local.id, (remote.version ?? 0) + 1);
            return;
        }

        let baseVer = remote.version ?? 0;

        // 2. Check Metadata
        const metadataChanges = this.getMetadataChanges(local, remote);
        if (metadataChanges) {
            await this.supabaseRepo.updateTournamentMetadata(local.id, {
                ...metadataChanges,
                version: baseVer
            });
            baseVer++; // Version incremented after metadata update
        }

        // 3. Check Matches
        const matchUpdates = this.getMatchUpdates(local, remote);
        if (matchUpdates.length > 0) {
            await this.supabaseRepo.updateMatches(local.id, matchUpdates, baseVer);
            baseVer++;
        }

        // 4. Update local version to match the new cloud version
        // This prevents the "Local is newer" loop
        await this.localRepo.updateLocalVersion(local.id, baseVer);
    }

    private hasStructuralChanges(local: Tournament, remote: Tournament): boolean {
        // Teams changed?
        if (local.teams.length !== remote.teams.length) {return true;}
        // Simple ID check (order matters?)
        // Deep check for teams (names, etc.)
        if (JSON.stringify(local.teams) !== JSON.stringify(remote.teams)) {return true;}

        // Match count/ids
        if (local.matches.length !== remote.matches.length) {return true;}
        const localMatchIds = local.matches.map(m => m.id).sort().join(',');
        const remoteMatchIds = remote.matches.map(m => m.id).sort().join(',');
        if (localMatchIds !== remoteMatchIds) {return true;}

        // Groups/Fields
        if (JSON.stringify(local.groups) !== JSON.stringify(remote.groups)) {return true;}
        if (JSON.stringify(local.fields) !== JSON.stringify(remote.fields)) {return true;}

        return false;
    }

    private getMetadataChanges(local: Tournament, remote: Tournament): Partial<Tournament> | null {
        const changes: Partial<Tournament> = {};
        let hasChanges = false;

        if (local.title !== remote.title) { changes.title = local.title; hasChanges = true; }
        if (local.date !== remote.date) { changes.date = local.date; hasChanges = true; }
        if (local.status !== remote.status) { changes.status = local.status; hasChanges = true; }
        if (local.isPublic !== remote.isPublic) { changes.isPublic = local.isPublic; hasChanges = true; }
        if (local.startTime !== remote.startTime) { changes.startTime = local.startTime; hasChanges = true; }

        // Location (deep check or simple JSON)
        if (JSON.stringify(local.location) !== JSON.stringify(remote.location)) {
            changes.location = local.location;
            hasChanges = true;
        }

        return hasChanges ? changes : null;
    }

    private getMatchUpdates(local: Tournament, remote: Tournament): MatchUpdate[] {
        const updates: MatchUpdate[] = [];

        for (const lMatch of local.matches) {
            const rMatch = remote.matches.find(m => m.id === lMatch.id);
            if (!rMatch) {continue;} // Should be caught by structural check

            const update: MatchUpdate = { id: lMatch.id };
            let updated = false;

            if (lMatch.scoreA !== rMatch.scoreA) { update.scoreA = lMatch.scoreA; updated = true; }
            if (lMatch.scoreB !== rMatch.scoreB) { update.scoreB = lMatch.scoreB; updated = true; }
            if (lMatch.matchStatus !== rMatch.matchStatus) { update.matchStatus = lMatch.matchStatus; updated = true; }
            if (lMatch.timerElapsedSeconds !== rMatch.timerElapsedSeconds) { update.timerElapsedSeconds = lMatch.timerElapsedSeconds; updated = true; }
            // Add other granular fields if needed

            if (updated) {
                updates.push(update);
            }
        }
        return updates;
    }

    /**
     * Pull changes from cloud to local.
     * Strategy:
     * 1. Get remote version from Supabase
     * 2. Compare with local version
     * 3. If remote is newer → update local
     * 4. If local is newer → return 'synced' (handled by syncUp)
     * 5. Detect conflicts for concurrent edits
     */
    async syncDown(tournamentId: string): Promise<SyncResult> {
        try {
            // 1. Get both versions
            const [remoteT, localT] = await Promise.all([
                this.supabaseRepo.get(tournamentId),
                this.localRepo.get(tournamentId),
            ]);

            // Case: No remote data
            if (!remoteT) {
                if (localT) {
                    // Local exists but not remote - needs syncUp
                    return { status: 'synced', data: localT };
                }
                return { status: 'error', error: 'Tournament not found' };
            }

            // Case: No local data - just save remote
            if (!localT) {
                await this.localRepo.save(remoteT);
                return { status: 'updated', data: remoteT };
            }

            // 2. Compare timestamps
            const localDate = new Date(localT.updatedAt).getTime();
            const remoteDate = new Date(remoteT.updatedAt).getTime();

            // Case: Already in sync
            if (localDate === remoteDate) {
                return { status: 'synced', data: localT };
            }

            // Case: Remote is newer - update local
            if (remoteDate > localDate) {
                // Check for conflicts in match scores (most critical data)
                const conflicts = this.detectMatchConflicts(localT, remoteT);

                if (conflicts.length > 0) {
                    // We have conflicts - don't auto-merge, return conflict status
                    return { status: 'conflict', data: remoteT, conflicts };
                }

                // No conflicts - safe to update local
                await this.localRepo.save(remoteT);
                return { status: 'updated', data: remoteT };
            }

            // Case: Local is newer - nothing to do for syncDown
            // This will be handled by syncUp
            return { status: 'synced', data: localT };

        } catch (error) {
            // Check if we're offline
            if (!navigator.onLine) {
                return { status: 'offline', error: 'No internet connection' };
            }

            console.error('SyncDown failed:', error);
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Detects conflicts between local and remote match scores.
     * Uses Last-Write-Wins (LWW) for automatic resolution where possible.
     */
    private detectMatchConflicts(local: Tournament, remote: Tournament): SyncConflict[] {
        const conflicts: SyncConflict[] = [];

        for (const localMatch of local.matches) {
            const remoteMatch = remote.matches.find(m => m.id === localMatch.id);

            if (!remoteMatch) {
                continue; // New local match, handled by syncUp
            }

            // Check for score conflicts
            const localHasScore = localMatch.scoreA !== undefined && localMatch.scoreB !== undefined;
            const remoteHasScore = remoteMatch.scoreA !== undefined && remoteMatch.scoreB !== undefined;

            if (localHasScore && remoteHasScore) {
                const scoresDiffer =
                    localMatch.scoreA !== remoteMatch.scoreA ||
                    localMatch.scoreB !== remoteMatch.scoreB;

                if (scoresDiffer) {
                    // Get team names for conflict display
                    const homeTeam = local.teams.find(t => t.id === localMatch.teamA);
                    const awayTeam = local.teams.find(t => t.id === localMatch.teamB);
                    const matchName = `${homeTeam?.name ?? 'Team A'} vs ${awayTeam?.name ?? 'Team B'}`;

                    conflicts.push({
                        id: `${localMatch.id}-score`,
                        entityType: 'match',
                        entityId: localMatch.id,
                        entityName: matchName,
                        field: 'score',
                        localValue: `${localMatch.scoreA}:${localMatch.scoreB}`,
                        remoteValue: `${remoteMatch.scoreA}:${remoteMatch.scoreB}`,
                        localTimestamp: local.updatedAt,
                        remoteTimestamp: remote.updatedAt,
                    });
                }
            }
        }

        return conflicts;
    }

    /**
     * Resolves a conflict by choosing local or remote version.
     */
    async resolveConflict(
        tournamentId: string,
        resolution: 'local' | 'remote'
    ): Promise<SyncResult> {
        try {
            if (resolution === 'local') {
                // Push local to cloud
                const local = await this.localRepo.get(tournamentId);
                if (local) {
                    await this.supabaseRepo.save(local);
                    return { status: 'synced', data: local };
                }
            } else {
                // Pull remote to local
                const remote = await this.supabaseRepo.get(tournamentId);
                if (remote) {
                    await this.localRepo.save(remote);
                    return { status: 'updated', data: remote };
                }
            }
            return { status: 'error', error: 'Tournament not found' };
        } catch (error) {
            return {
                status: 'error',
                error: error instanceof Error ? error.message : 'Resolution failed',
            };
        }
    }

    /**
     * Full bidirectional sync for a single tournament.
     * 1. Pull remote changes (syncDown)
     * 2. Push local changes (syncUp for single tournament)
     */
    async syncTournament(tournamentId: string): Promise<SyncResult> {
        // First, pull remote changes
        const downResult = await this.syncDown(tournamentId);

        // If there was a conflict or error, return that
        if (downResult.status === 'conflict' || downResult.status === 'error') {
            return downResult;
        }

        // Then, try to push local changes if needed
        try {
            const local = await this.localRepo.get(tournamentId);
            if (local) {
                const remote = await this.supabaseRepo.get(tournamentId);
                if (!remote || new Date(local.updatedAt) > new Date(remote.updatedAt)) {
                    await this.supabaseRepo.save(local);
                }
            }
            return { status: 'synced', data: local ?? downResult.data };
        } catch (error) {
            // If push fails (offline), still return success for the pull
            console.warn('SyncUp part failed, but syncDown succeeded:', error);
            return downResult;
        }
    }
}
