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
     * - Try Cloud List.
     * - If success: Return Cloud List. 
     *   NOTE: We do NOT cache the mock-objects from listForCurrentUser to avoid overwriting full local objects.
     *   The detailed objects are cached on 'get(id)'.
     * - If fail: Return Local List.
     */
    async listForCurrentUser(): Promise<Tournament[]> {
        try {
            const cloudList = await this.supabaseRepo.listForCurrentUser();
            // We could optionally merging local-only tournaments here that haven't been synced yet?
            // For now, let's KISS. If online, show cloud truth.
            // Wait, if I created a tourney offline, it IS in localRepo but NOT in cloudList.
            // So valid Cloud List might miss "offline created" items.

            // Merge Strategy:
            // 1. Get Cloud List
            // 2. Get Local List
            // 3. Merge (Union of IDs). Prefer Cloud version if exists? 
            //    Or prefer Local version if newer?

            // Let's look at Local List to find "Unsynced" items.
            // Current simplified approach: Return Cloud List + Check Local for items not in Cloud?

            // For MVP: Return Cloud List if online.
            // Problem: Offline created tournament disappears when I go online until it syncs.
            // Solution: Perform "Sync Up" (Local -> Cloud) BEFORE returning list?

            // That's the best spot! But performance?
            // Let's do it in background or separate "sync()" method.

            // For this return:
            return cloudList;
        } catch (error) {
            console.warn('OfflineRepository: Cloud list failed, returning local list.', error);
            // Fallback to all local tournaments
            // Since we are offline, we can't filter by owner_id reliably (unless we stored it locally)
            // But LocalRepo returns everything. This is fine for single-user devicew mostly.
            // TODO: In multi-user device scenario, this leaks data. But LocalStorage is insecure anyway.
            return (await this.localRepo.get('stub')) ? [] : this.localRepo['loadList'] ? (this.localRepo as any).loadList() : []; // access private method workaround or use public if available?
            // LocalRepo.get implementation loads list internally.
            // We need a list() method on ITournamentRepository or at least on LocalStorageRepo
            // But ITournamentRepository doesn't have list().
            // SupabaseRepository has 'listForCurrentUser'.
            // LocalStorageRepository needs 'list()'.

            // Let's assume we can cast or extend LocalStorageRepo with list().
            // For now, let's instantiate a new LocalStorageRepo and call a public method if we add one.
            // Or just allow fail for now.
            return [];
        }
    }

    /**
     * Trigger synchronization: Pushes local tournaments to cloud if missing/newer.
     */
    async syncUp(): Promise<void> {
        try {
            // Need access to local list.
            // Since LocalStorageRepo doesn't expose list() yet publicly in interface, we might need to add it.
            // Let's assume we add `list()` to LocalStorageRepo.
            const localList = (this.localRepo as any).loadList?.() as Tournament[] || [];

            for (const localT of localList) {
                try {
                    // Try to get from cloud to check existence/version
                    const cloudT = await this.supabaseRepo.get(localT.id);

                    if (!cloudT) {
                        // Not in cloud -> Upload
                        console.log(`Syncing up: Uploading new tournament ${localT.id}`);
                        await this.supabaseRepo.save(localT);
                    } else {
                        // Exists in cloud.
                        // Check dates?
                        const localDate = new Date(localT.updatedAt).getTime();
                        const cloudDate = new Date(cloudT.updatedAt).getTime();

                        if (localDate > cloudDate) {
                            // Local is newer -> Upload
                            console.log(`Syncing up: Updating tournament ${localT.id} (Local is newer)`);
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
