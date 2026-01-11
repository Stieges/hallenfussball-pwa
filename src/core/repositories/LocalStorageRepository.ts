import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { TournamentSchema } from '../models/schemas/TournamentSchema';
import { STORAGE_KEYS } from '../../constants/storage';
import { hydrateTournament } from './hydration';

export class LocalStorageRepository implements ITournamentRepository {

    async get(id: string): Promise<Tournament | null> {
        const list = this.loadList();
        return list.find(t => t.id === id) ?? null;
    }

    async getByShareCode(_code: string): Promise<Tournament | null> {
        // Local storage does not support share codes, as they are a cloud feature.
        // potentially we could scan for them, but for now we return null.
        return null;
    }

    async save(tournament: Tournament): Promise<void> {
        const list = this.loadList();
        const index = list.findIndex(t => t.id === tournament.id);

        if (index >= 0) {
            list[index] = { ...tournament, updatedAt: new Date().toISOString() };
        } else {
            list.push({ ...tournament, updatedAt: new Date().toISOString() });
        }

        this.saveList(list);
    }

    async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
        return this.updateMatches(tournamentId, [update]);
    }

    async updateMatches(tournamentId: string, updates: MatchUpdate[]): Promise<void> {
        const list = this.loadList();
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
            updatedAt: new Date().toISOString()
        };

        this.saveList(list);
    }

    async delete(id: string): Promise<void> {
        const list = this.loadList();
        const filtered = list.filter(t => t.id !== id);
        this.saveList(filtered);
    }

    async listForCurrentUser(): Promise<Tournament[]> {
        return this.loadList();
    }

    // --- Private Helpers ---

    private loadList(): Tournament[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.TOURNAMENTS);
            if (!stored) { return []; }
            const raw = JSON.parse(stored) as unknown;
            if (!Array.isArray(raw)) { return []; }
            const rawArray = raw as unknown[];

            return rawArray.map((item) => {
                const itemData = item as Record<string, unknown>;
                // Validate each item
                const result = TournamentSchema.safeParse(itemData);
                if (result.success) {
                    // Hydrate: Convert date strings back to Date objects
                    return hydrateTournament(result.data as unknown);
                }
                // If validation fails, log but return raw item to avoid data loss during migration
                // Still hydrate to ensure date fields are proper Date objects
                console.warn(`Tournament ${String(itemData.id)} validation failed:`, result.error);
                return hydrateTournament(itemData);
            });
        } catch (e) {
            console.error('Failed to load tournaments', e);
            return [];
        }
    }

    private saveList(list: Tournament[]): void {
        localStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(list));
    }
}
