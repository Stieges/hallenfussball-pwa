

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchExecutionService } from '../MatchExecutionService';
import { ILiveMatchRepository } from '../../repositories/ILiveMatchRepository';
import { ITournamentRepository } from '../../repositories/ITournamentRepository';
import { LiveMatch } from '../../models/LiveMatch';
import { ScheduledMatch } from '../../../core/generators';
import { MatchStatus } from '../../models/LiveMatch';

// Mock implementations
const mockLiveMatchRepo = {
    get: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
    saveAll: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn()
};

const mockTournamentRepo = {
    get: vi.fn(),
    save: vi.fn(),
};

describe('MatchExecutionService', () => {
    let service: MatchExecutionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MatchExecutionService(
            mockLiveMatchRepo as unknown as ILiveMatchRepository,
            mockTournamentRepo as unknown as ITournamentRepository
        );
    });

    const mockScheduledMatch: ScheduledMatch = {
        id: 'match-1',
        time: '12:00',
        field: 1,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        phase: 'groupStage',
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T12:15:00Z'),
        duration: 15,
        matchNumber: 1,
        originalTeamA: 'team-a',
        originalTeamB: 'team-b',
        tournamendId: 'tour-1' // Not in interface? Check scheduleTypes or generic. ScheduledMatch doesn't have tournamentId usually.
    } as unknown as ScheduledMatch;

    const minimalLiveMatch: LiveMatch = {
        id: 'match-1',
        tournamentId: 'tour-1',
        number: 1,
        status: 'NOT_STARTED',
        phaseLabel: 'Group Stage',
        fieldId: 'field-1',
        scheduledKickoff: '2024-01-01T12:00:00.000Z',
        durationSeconds: 900,
        homeTeam: { id: 'team-a', name: 'Team A' },
        awayTeam: { id: 'team-b', name: 'Team B' },
        homeScore: 0,
        awayScore: 0,
        elapsedSeconds: 0,
        events: []
    } as unknown as LiveMatch;

    it('should initialize a match correctly', async () => {
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(null);
        vi.mocked(mockTournamentRepo.get).mockResolvedValue({
            id: 'tour-1',
            finalsConfig: { tiebreaker: 'shootout' },
            teams: [
                { id: 'team-a', name: 'Team A' },
                { id: 'team-b', name: 'Team B' }
            ]
        } as any);

        const result = await service.initializeMatch('tour-1', mockScheduledMatch);

        expect(result.id).toBe('match-1');
        expect(result.status).toBe('NOT_STARTED');
        expect(result.homeTeam.name).toBe('Team A');
        expect(mockLiveMatchRepo.save).toHaveBeenCalledWith('tour-1', expect.any(Object));
    });

    it('should start a match', async () => {
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(minimalLiveMatch);

        const result = await service.startMatch('tour-1', 'match-1');

        expect(result.status).toBe('RUNNING');
        expect(result.timerStartTime).toBeDefined();
        // Should add STATUS_CHANGE event
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe('STATUS_CHANGE');
        expect(mockLiveMatchRepo.save).toHaveBeenCalled();
    });

    it('should record a goal', async () => {
        const runningMatch = {
            ...minimalLiveMatch,
            status: 'RUNNING' as MatchStatus,
            timerStartTime: new Date().toISOString()
        };
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

        const result = await service.recordGoal('tour-1', 'match-1', 'home', 1);

        expect(result.homeScore).toBe(1);
        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe('GOAL');
        expect(result.events[0].payload.team).toBe('home');
    });

    it('should record substitutions', async () => {
        const runningMatch = {
            ...minimalLiveMatch,
            status: 'RUNNING' as MatchStatus,
            events: []
        };
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

        const result = await service.recordSubstitution('tour-1', 'match-1', 'home', {
            playersIn: [10],
            playersOut: [5]
        });

        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe('SUBSTITUTION');
        const payload = result.events[0].payload as any;
        expect(payload.playersIn).toEqual([10]);
        expect(payload.playersOut).toEqual([5]);
    });

    it('should record cards', async () => {
        const runningMatch = { ...minimalLiveMatch, status: 'RUNNING' as MatchStatus };
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(runningMatch);

        const result = await service.recordCard('tour-1', 'match-1', 'away', 'YELLOW', { playerNumber: 7 });

        expect(result.events.length).toBe(1);
        expect(result.events[0].type).toBe('YELLOW_CARD');
        expect(result.events[0].payload.team).toBe('away');
        expect(result.events[0].payload.playerNumber).toBe(7);
    });

    it('should manually update result', async () => {
        vi.mocked(mockLiveMatchRepo.get).mockResolvedValue(minimalLiveMatch);

        const result = await service.updateResultManually('tour-1', 'match-1', 5, 3);

        expect(result.homeScore).toBe(5);
        expect(result.awayScore).toBe(3);
        expect(mockLiveMatchRepo.save).toHaveBeenCalledWith('tour-1', expect.objectContaining({
            homeScore: 5,
            awayScore: 3
        }));
    });
});
