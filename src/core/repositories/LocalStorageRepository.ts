import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { TournamentSchema } from '../models/schemas/TournamentSchema';
import { STORAGE_KEYS } from '../../constants/storage';
import { hydrateTournament } from './hydration';
import { createStorage } from '../storage/StorageFactory';

export class LocalStorageRepository implements ITournamentRepository {

    async get(id: string): Promise<Tournament | null> {
        const list = await this.loadList();
        return list.find(t => t.id === id) ?? null;
    }

    async getByShareCode(_code: string): Promise<Tournament | null> {
        // Local storage does not support share codes, as they are a cloud feature.
        return null;
    }

    async save(tournament: Tournament): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === tournament.id);

        if (index >= 0) {
            const currentVersion = list[index].version ?? 0;
            list[index] = { ...tournament, version: currentVersion + 1, updatedAt: new Date().toISOString() };
        } else {
            list.push({ ...tournament, version: 1, updatedAt: new Date().toISOString() });
        }

        await this.saveList(list);
    }

    async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === id);

        if (index === -1) {
            throw new Error(`Tournament ${id} not found`);
        }

        list[index] = {
            ...list[index],
            ...metadata,
            version: (list[index].version ?? 0) + 1,
            updatedAt: new Date().toISOString()
        };

        await this.saveList(list);
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        return this.updateMatches(tournamentId, [update]);
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[], _baseVersion?: number): Promise<void> {
        const list = await this.loadList();
        const tournamentIndex = list.findIndex(t => t.id === tournamentId);

        if (tournamentIndex === -1) {
            throw new Error(`Tournament ${tournamentId} not found`);
        }

        const tournament = list[tournamentIndex];
        const updateMap = new Map(updates.map(u => [u.id, u]));

        const updatedMatches = tournament.matches.map(m => {
            const update = updateMap.get(m.id);
            if (update) {
                return { ...m, ...update };
            }
            return m;
        });

        list[tournamentIndex] = {
            ...tournament,
            matches: updatedMatches,
            version: (tournament.version ?? 0) + 1,
            updatedAt: new Date().toISOString()
        };

        await this.saveList(list);
    }

    async delete(id: string): Promise<void> {
        const list = await this.loadList();
        const filtered = list.filter(t => t.id !== id);
        await this.saveList(filtered);
    }

    async listForCurrentUser(): Promise<Tournament[]> {
        return this.loadList();
    }

    /**
     * Updates the local version number after a successful cloud sync.
     * Does NOT increment - sets it to the exact value from cloud.
     */
    async updateLocalVersion(id: string, version: number): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], version };
            await this.saveList(list);
        }
    }

    // ==========================================================================
    // VISIBILITY & SHARING (local implementation)
    // ==========================================================================

    /**
     * Makes a tournament publicly accessible by generating a local share code.
     * Note: Local share codes are only valid within this browser instance.
     */
    async makeTournamentPublic(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === tournamentId);

        if (index === -1) {
            return null;
        }

        const shareCode = this.generateLocalShareCode();
        const createdAt = new Date().toISOString();

        list[index] = {
            ...list[index],
            isPublic: true,
            shareCode,
            shareCodeCreatedAt: createdAt,
            version: (list[index].version ?? 0) + 1,
            updatedAt: createdAt
        };

        await this.saveList(list);

        return { shareCode, createdAt };
    }

    /**
     * Makes a tournament private by removing the share code.
     */
    async makeTournamentPrivate(tournamentId: string): Promise<void> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === tournamentId);

        if (index === -1) {
            throw new Error(`Tournament ${tournamentId} not found`);
        }

        list[index] = {
            ...list[index],
            isPublic: false,
            shareCode: undefined,
            shareCodeCreatedAt: undefined,
            version: (list[index].version ?? 0) + 1,
            updatedAt: new Date().toISOString()
        };

        await this.saveList(list);
    }

    /**
     * Regenerates the share code for a public tournament.
     */
    async regenerateShareCode(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
        const list = await this.loadList();
        const index = list.findIndex(t => t.id === tournamentId);

        if (index === -1) {
            return null;
        }

        const tournament = list[index];
        if (!tournament.isPublic) {
            return null;
        }

        const shareCode = this.generateLocalShareCode();
        const createdAt = new Date().toISOString();

        list[index] = {
            ...list[index],
            shareCode,
            shareCodeCreatedAt: createdAt,
            version: (list[index].version ?? 0) + 1,
            updatedAt: createdAt
        };

        await this.saveList(list);

        return { shareCode, createdAt };
    }

    /**
     * Generates a 6-character alphanumeric share code for local use.
     */
    private generateLocalShareCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // --- Private Helpers ---

    private async loadList(): Promise<Tournament[]> {
        try {
            const storage = await createStorage();
            const raw = await storage.get(STORAGE_KEYS.TOURNAMENTS);

            if (!raw) { return []; }
            if (!Array.isArray(raw)) { return []; }

            return raw.map((item) => {
                const itemData = item as Record<string, unknown>;
                // Validate each item
                const result = TournamentSchema.safeParse(itemData);
                if (result.success) {
                    // Hydrate: Convert date strings back to Date objects
                    return hydrateTournament(result.data as unknown);
                }
                // If validation fails, log but return raw item to avoid data loss during migration
                // Still hydrate to ensure date fields are proper Date objects
                if (import.meta.env.DEV) {
                    console.warn(`Tournament ${String(itemData.id)} validation failed:`, result.error);
                }
                return hydrateTournament(itemData);
            });
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to load tournaments', e);
            }
            return [];
        }
    }

    private async saveList(list: Tournament[]): Promise<void> {
        try {
            const storage = await createStorage();
            await storage.set(STORAGE_KEYS.TOURNAMENTS, list);
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to save tournaments', e);
            }
            throw e; // Propagate error so UI can handle it (or retry)
        }
    }
}
