
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TournamentCreationService } from './TournamentCreationService';
import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { generateFullSchedule } from '../generators';

// Mock dependencies
vi.mock('../generators', () => ({
    generateFullSchedule: vi.fn(),
}));

// Mock utils if needed, but they are pure functions usually
// We rely on getSportConfig being available.

describe('TournamentCreationService', () => {
    let service: TournamentCreationService;
    // mockRepo defined as implicit object with Mock types
    let mockRepo: any; // Using any or specific Mock type, or just let to be reassigned

    beforeEach(() => {
        mockRepo = {
            get: vi.fn(),
            save: vi.fn(),
            updateMatch: vi.fn(),
            updateMatches: vi.fn(),
            delete: vi.fn(),
        };
        service = new TournamentCreationService(mockRepo as ITournamentRepository);
        vi.clearAllMocks();
    });

    describe('createDraft', () => {
        it('should create a draft with defaults when no data provided', () => {
            const draft = service.createDraft();
            expect(draft.status).toBe('draft');
            expect(draft.id).toBeDefined();
            expect(draft.teams).toEqual([]);
            expect(draft.mode).toBe('classic');
        });

        it('should merge provided data', () => {
            const data: Partial<Tournament> = {
                title: 'My Tournament',
                numberOfTeams: 8,
            };
            const draft = service.createDraft(data);
            expect(draft.title).toBe('My Tournament');
            expect(draft.numberOfTeams).toBe(8);
            expect(draft.status).toBe('draft');
        });

        it('should preserve existing ID if provided', () => {
            const existingId = 'test-id-123';
            const draft = service.createDraft({}, existingId);
            expect(draft.id).toBe(existingId);
        });
    });

    describe('validateStep', () => {
        it('should validate step 1 (Basic Info)', () => {
            // Empty data
            let errors = service.validateStep(1, {});
            expect(errors).toContain('Turniername erforderlich');
            expect(errors).toContain('Startdatum erforderlich');
            expect(errors).toContain('Ort erforderlich');

            // Valid data
            errors = service.validateStep(1, { title: 'T', date: '2023-01-01', location: { name: 'Gym' } });
            expect(errors).toHaveLength(0);
        });

        it('should validate step 5 (Teams)', () => {
            // Not enough teams
            let errors = service.validateStep(5, { teams: [] });
            expect(errors).toContain('Mindestens 2 Teams erforderlich');

            // Duplicates
            errors = service.validateStep(5, {
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'A' } // Duplicate
                ] as any
            });
            expect(errors).toContain('Teamnamen müssen eindeutig sein');

            // Valid
            errors = service.validateStep(5, {
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'B' }
                ] as any
            });
            expect(errors).toHaveLength(0);
        });
    });

    describe('saveDraft', () => {
        it('should call repository.save', async () => {
            const data = { title: 'Draft' };
            await service.saveDraft(data);
            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Draft',
                status: 'draft',
                updatedAt: expect.any(String)
            }));
        });
    });

    describe('publish', () => {
        it('should generate schedule, set status to published, and save', async () => {
            // Mock generateFullSchedule return
            const mockSchedule = {
                allMatches: [
                    { id: 'm1', originalTeamA: 't1', originalTeamB: 't2', field: 1 },
                ],
            };
            (generateFullSchedule as any).mockReturnValue(mockSchedule);

            const data = {
                title: 'Published',
                numberOfFields: 1,
                groups: [{ id: 'g1', name: 'A' }],
                teams: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }]
            };

            await service.publish(data);

            expect(generateFullSchedule).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Published',
                status: 'published',
                matches: expect.arrayContaining([
                    expect.objectContaining({ id: 'm1', teamA: 't1' })
                ])
            }));
        });
    });
});
