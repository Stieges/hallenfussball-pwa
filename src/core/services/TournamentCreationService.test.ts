
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

            // Valid data — future date
            const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            errors = service.validateStep(1, { title: 'T', date: future, location: { name: 'Gym' } });
            expect(errors).toHaveLength(0);
        });

        // Uses local-date formatting to match the production validator
        // (TournamentCreationService.isPastDate compares against local
        // calendar day). UTC-based ISO strings diverge near midnight.
        function localIsoDate(d: Date): string {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        it('F-113: should reject past start dates in step 1', () => {
            const yesterday = localIsoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
            const errors = service.validateStep(1, {
                title: 'T',
                date: yesterday,
                location: { name: 'Gym' },
            });
            expect(errors).toContain('Startdatum darf nicht in der Vergangenheit liegen');
        });

        it("F-113: should accept today's date as start date", () => {
            const today = localIsoDate(new Date());
            const errors = service.validateStep(1, {
                title: 'T',
                date: today,
                location: { name: 'Gym' },
            });
            expect(errors).not.toContain('Startdatum darf nicht in der Vergangenheit liegen');
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

        it('F-114: rejects empty/whitespace-only team names', () => {
            const errors = service.validateStep(5, {
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: '   ' },
                    { id: '3', name: '' },
                ] as any,
            });
            expect(errors).toContain('Teamnamen dürfen nicht leer sein');
        });

        it('F-209: rejects mismatch between numberOfTeams and teams.length', () => {
            const errors = service.validateStep(5, {
                numberOfTeams: 4,
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'B' },
                    { id: '3', name: 'C' },
                ] as any,
            });
            expect(errors.some(e => e.includes('3 von 4'))).toBe(true);
        });

        it('F-209: no mismatch error when numberOfTeams matches teams.length', () => {
            const errors = service.validateStep(5, {
                numberOfTeams: 2,
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'B' },
                ] as any,
            });
            expect(errors.find(e => e.includes('von'))).toBeUndefined();
        });

        it('F-116: groupsAndFinals — group with empty allowedFieldIds is rejected', () => {
            const errors = service.validateStep(4, {
                groupSystem: 'groupsAndFinals',
                groups: [
                    { id: '1', customName: 'A', allowedFieldIds: ['f1'] },
                    { id: '2', customName: 'B', allowedFieldIds: [] }, // Missing assignment
                ] as any,
                fields: [{ id: 'f1', customName: 'Halle' }] as any,
            });
            expect(errors).toContain('Jede Gruppe muss mindestens einem Feld zugeordnet sein');
        });

        it('F-116: groupsAndFinals — undefined allowedFieldIds is valid (uses all fields)', () => {
            const errors = service.validateStep(4, {
                groupSystem: 'groupsAndFinals',
                groups: [
                    { id: '1', customName: 'A' },
                    { id: '2', customName: 'B' },
                ] as any,
                fields: [{ id: 'f1', customName: 'Halle' }] as any,
            });
            expect(errors).not.toContain('Jede Gruppe muss mindestens einem Feld zugeordnet sein');
        });

        it('F-116: roundRobin — empty allowedFieldIds is not flagged (groups unused)', () => {
            const errors = service.validateStep(4, {
                groupSystem: 'roundRobin',
                groups: [{ id: '1', customName: 'A', allowedFieldIds: [] }] as any,
                fields: [{ id: 'f1', customName: 'Halle' }] as any,
            });
            expect(errors).not.toContain('Jede Gruppe muss mindestens einem Feld zugeordnet sein');
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
