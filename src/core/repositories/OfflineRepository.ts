import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { LocalStorageRepository } from './LocalStorageRepository';
import { SupabaseRepository } from './SupabaseRepository';

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
}
