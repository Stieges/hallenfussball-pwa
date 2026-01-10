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
    constructor(
        private localRepo: LocalStorageRepository,
        private supabaseRepo: SupabaseRepository
    ) { }

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
                // We use void to not block the return, but for data consistency it might be better to await
                // await this.localRepo.save(cloudData); 
                // However, let's await to ensure cache is valid before next step
                await this.localRepo.save(cloudData);
                return cloudData;
            } else {
                // Not found in cloud (deleted? or really new?). 
                // If it returned null, it means 404. 
                // Should we check local? Maybe it was created locally and not synced yet.
                return await this.localRepo.get(id);
            }
        } catch (error) {
            console.warn('OfflineRepository: Cloud fetch failed, falling back to local.', error);
            // 3. Fallback to Cache
            return await this.localRepo.get(id);
        }
    }

    async getByShareCode(code: string): Promise<Tournament | null> {
        // Share codes are Cloud-only features usually.
        // But if we cached it locally? LocalStorageRepo currently returns null.
        // So we just pass through to Supabase.
        try {
            return await this.supabaseRepo.getByShareCode(code);
        } catch (error) {
            console.warn('OfflineRepository: Cloud fetch by share code failed.', error);
            return null;
        }
    }

    /**
     * Saves to BOTH Supabase and LocalStorage.
     * Strategies:
     * - Optimistic: Save Local -> Return -> Background Sync
     * - Safety: Save Local -> Save Cloud -> Return
     * 
     * We choose "Safety with Offline Tberance":
     * Always save Local. Try save Cloud. If Cloud fails, swallow error (it's cached locally now).
     */
    async save(tournament: Tournament): Promise<void> {
        // 1. Save Local (Always succeeds unless disk full)
        await this.localRepo.save(tournament);

        // 2. Try Save Cloud
        try {
            await this.supabaseRepo.save(tournament);
        } catch (error) {
            console.warn('OfflineRepository: Cloud save failed (offline?), data saved locally.', error);
            // We do NOT throw here. The user can continue working.
            // Sync needs to happen later (e.g. on next app start/online event).
        }
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        await this.localRepo.updateMatch(tournamentId, update);
        try {
            await this.supabaseRepo.updateMatch(tournamentId, update);
        } catch (error) {
            console.warn('OfflineRepository: Cloud updateMatch failed (offline?).', error);
        }
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[]): Promise<void> {
        await this.localRepo.updateMatches(tournamentId, updates);
        try {
            await this.supabaseRepo.updateMatches(tournamentId, updates);
        } catch (error) {
            console.warn('OfflineRepository: Cloud updateMatches failed (offline?).', error);
        }
    }

    async delete(id: string): Promise<void> {
        await this.localRepo.delete(id);
        try {
            await this.supabaseRepo.delete(id);
        } catch (error) {
            console.warn('OfflineRepository: Cloud delete failed (offline?).', error);
        }
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
            const cloudList = await this.supabaseRepo.listForCurrentUser();
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
                        // Not in cloud -> Upload
                        await this.supabaseRepo.save(localT);
                    } else {
                        // Exists in cloud.
                        // Check dates?
                        const localDate = new Date(localT.updatedAt).getTime();
                        const cloudDate = new Date(cloudT.updatedAt).getTime();

                        if (localDate > cloudDate) {
                            // Local is newer -> Upload
                            await this.supabaseRepo.save(localT);
                        }
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
