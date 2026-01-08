
import { describe, it, expect, vi } from 'vitest';
import { MatchExecutionService } from '../MatchExecutionService';
import { LiveMatch, MatchEvent, MatchEventType } from '../../models/LiveMatch';

// Mock Interfaces
const mockLiveMatchRepo = {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(), // If needed
    getAll: vi.fn(),
};

const mockTournamentRepo = {
    get: vi.fn(),
    updateMatch: vi.fn(),
    save: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
};

describe('MatchExecutionService - Event Persistence', () => {

    it('should persist events to the match object when finishing a match', async () => {
        // Setup
        const matchId = 'test-match-1';
        const tournamentId = 'tourney-1';

        const eventsMock: MatchEvent[] = [
            {
                id: 'evt1',
                matchId: matchId,
                type: 'GOAL' as MatchEventType,
                timestampSeconds: 60,
                payload: { team: 'home', playerNumber: 10 },
                scoreAfter: { home: 1, away: 0 }
            }
        ];

        const liveMatch: LiveMatch = {
            id: matchId,
            number: 1,
            phaseLabel: 'Group A',
            fieldId: 'field-1',
            scheduledKickoff: new Date().toISOString(),
            homeTeam: { id: 't1', name: 'Home' },
            awayTeam: { id: 't2', name: 'Away' },
            homeScore: 1,
            awayScore: 0,
            status: 'RUNNING',
            elapsedSeconds: 60,
            durationSeconds: 600,
            events: eventsMock,
            playPhase: 'regular',
            tournamentPhase: 'groupStage'
        };

        // Mocks
        mockLiveMatchRepo.get.mockResolvedValue(liveMatch);

        // Service
        const service = new MatchExecutionService(mockLiveMatchRepo as any, mockTournamentRepo as any);

        // Execute
        await service.finishMatch(tournamentId, matchId);

        // Verify
        expect(mockTournamentRepo.updateMatch).toHaveBeenCalledWith(
            tournamentId,
            expect.objectContaining({
                id: matchId,
                matchStatus: 'finished',
                events: expect.arrayContaining([
                    expect.objectContaining({ id: 'evt1' })
                ])
            })
        );
    });
});
