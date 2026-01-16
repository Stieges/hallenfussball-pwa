
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineRepository } from './OfflineRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { Tournament } from '../models/types';

// Mock dependencies
vi.mock('./SupabaseRepository');
vi.mock('./LocalStorageRepository');

describe('OfflineRepository - Granular Sync', () => {
    let offlineRepo: OfflineRepository;
    let mockSupabase: any;
    let mockLocal: any;

    const baseTournament = {
        id: 't1',
        title: 'Base Title',
        date: '2025-01-01',
        status: 'draft',
        version: 1,
        teams: [{ id: 'te1', name: 'A' }, { id: 'te2', name: 'B' }],
        matches: [
            { id: 'm1', teamA: 'te1', teamB: 'te2', round: 1, matchNumber: 1, field: 1 }
        ],
        groups: [],
        fields: [{ id: 'field-1', defaultName: 'Feld 1' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    } as unknown as Tournament;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        mockSupabase = new SupabaseRepository() as any;
        mockLocal = new LocalStorageRepository() as any;

        // Default mock implementations
        mockLocal.listForCurrentUser.mockResolvedValue([]);
        mockLocal.updateLocalVersion.mockResolvedValue(undefined); // Critical for Phase 2 fix verification

        mockSupabase.get.mockResolvedValue(null);
        mockSupabase.save.mockResolvedValue(undefined);
        mockSupabase.updateTournamentMetadata.mockResolvedValue(undefined);
        mockSupabase.updateMatches.mockResolvedValue(undefined);

        offlineRepo = new OfflineRepository(mockLocal, mockSupabase);
    });

    it('should perform granular metadata update when only title changes', async () => {
        const localT = { ...baseTournament, title: 'New Title', version: 2 };
        const remoteT = { ...baseTournament, title: 'Old Title', version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).not.toHaveBeenCalled(); // Should NOT be full save
        expect(mockSupabase.updateTournamentMetadata).toHaveBeenCalledWith(
            't1',
            expect.objectContaining({ title: 'New Title', version: 1 }) // Base version passed!
        );
        expect(mockLocal.updateLocalVersion).toHaveBeenCalled(); // Phase 2 Fix Check
    });

    it('should perform granular match update when only score changes', async () => {
        const localMatch = { ...baseTournament.matches[0], scoreA: 1, scoreB: 0 };
        const localT = { ...baseTournament, matches: [localMatch], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).not.toHaveBeenCalled();
        expect(mockSupabase.updateMatches).toHaveBeenCalledWith(
            't1',
            expect.arrayContaining([expect.objectContaining({ id: 'm1', scoreA: 1 })]),
            1 // Base version
        );
        expect(mockLocal.updateLocalVersion).toHaveBeenCalled(); // Phase 2 Fix Check
    });

    it('should perform full save when structural changes occur (teams added)', async () => {
        const newTeam = { id: 'te3', name: 'C', tournamentId: 't1' };
        const localT = { ...baseTournament, teams: [...baseTournament.teams, newTeam], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).toHaveBeenCalled(); // MUST be full save
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });

    it('should update local version after successful sync', async () => {
        const localT = { ...baseTournament, title: 'Updated', version: 2 };
        const remoteT = { ...baseTournament, version: 1 }; // Remote is behind

        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        await offlineRepo.syncUp();

        // Expectation: After syncing (delta), we update local version to match what remote becomes (ver 2)
        // Note: Logic in code is: baseVer(1) -> update -> baseVer++ (2) -> updateLocal(2)
        expect(mockLocal.updateLocalVersion).toHaveBeenCalledWith('t1', 2);
    });

    it('should perform full save when team is renamed', async () => {
        // Same IDs, but name changed
        const renamedTeam = { ...baseTournament.teams[0], name: 'Renamed Team A' };
        const localT = { ...baseTournament, teams: [renamedTeam, baseTournament.teams[1]], version: 2 };
        const remoteT = { ...baseTournament, version: 1 };

        // Setup
        mockLocal.listForCurrentUser.mockResolvedValue([localT]);
        mockSupabase.get.mockResolvedValue(remoteT);

        // Execute
        await offlineRepo.syncUp();

        // Assert
        expect(mockSupabase.save).toHaveBeenCalled(); // Should trigger full save
        expect(mockSupabase.updateTournamentMetadata).not.toHaveBeenCalled();
    });
});
