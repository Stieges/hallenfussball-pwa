import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { TournamentSchema } from '../models/schemas/TournamentSchema';

const STORAGE_KEY = 'tournaments';

export class LocalStorageRepository implements ITournamentRepository {

    async get(id: string): Promise<Tournament | null> {
        const list = this.loadList();
        return list.find(t => t.id === id) || null;
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

    // --- Private Helpers ---

    private loadList(): Tournament[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {return [];}
            const raw = JSON.parse(stored);
            if (!Array.isArray(raw)) {return [];}

            return raw.map((item: any) => {
                // Validate each item
                const result = TournamentSchema.safeParse(item);
                if (result.success) {
                    return result.data as unknown as Tournament;
                }
                // If validation fails, log but return raw item to avoid data loss during migration
                console.warn(`Tournament ${item.id} validation failed:`, result.error);
                return item as Tournament;
            });
        } catch (e) {
            console.error('Failed to load tournaments', e);
            return [];
        }
    }

    private saveList(list: Tournament[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
}
