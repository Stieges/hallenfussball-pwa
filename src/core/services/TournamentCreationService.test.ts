
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TournamentCreationService } from './TournamentCreationService';
import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { localDateIso } from '../view/time';
import { generateFullSchedule } from '../generators';
import { vs, testUuid } from '../../test/matchSlotFixtures';

const T1 = testUuid(1);
const T2 = testUuid(2);

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

        // Gleiche Ortszeit-Funktion wie der Prüfer (@W1-038): Kalendertag in Europe/Berlin, unabhängig von der
        // Zeitzone des Rechners (CI läuft in UTC).
        const localIsoDate = localDateIso;

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
                ]
            });
            expect(errors).toContain('Teamnamen müssen eindeutig sein');

            // Valid
            errors = service.validateStep(5, {
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'B' }
                ]
            });
            expect(errors).toHaveLength(0);
        });

        it('F-114: rejects empty/whitespace-only team names', () => {
            const errors = service.validateStep(5, {
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: '   ' },
                    { id: '3', name: '' },
                ],
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
                ],
            });
            expect(errors.some(e => e.includes('3 von 4'))).toBe(true);
        });

        it('F-209: no mismatch error when numberOfTeams matches teams.length', () => {
            const errors = service.validateStep(5, {
                numberOfTeams: 2,
                teams: [
                    { id: '1', name: 'A' },
                    { id: '2', name: 'B' },
                ],
            });
            expect(errors.find(e => e.includes('von'))).toBeUndefined();
        });

        it('F-116: groupsAndFinals — group with empty allowedFieldIds is rejected', () => {
            const errors = service.validateStep(4, {
                groupSystem: 'groupsAndFinals',
                groups: [
                    { id: '1', customName: 'A', allowedFieldIds: ['f1'] },
                    { id: '2', customName: 'B', allowedFieldIds: [] }, // Missing assignment
                ],
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
                ],
                fields: [{ id: 'f1', customName: 'Halle' }] as any,
            });
            expect(errors).not.toContain('Jede Gruppe muss mindestens einem Feld zugeordnet sein');
        });

        it('F-116: roundRobin — empty allowedFieldIds is not flagged (groups unused)', () => {
            const errors = service.validateStep(4, {
                groupSystem: 'roundRobin',
                groups: [{ id: '1', customName: 'A', allowedFieldIds: [] }],
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

        // A-10 (brief-A-10.md § 8 Fall 14, Baustein Regel 3 – umgeschrieben): vorher „persists a result/status change via
        // updateMatches“. Ergebnis-/Status-Spalten schreibt seit A-10 nur der Server (append_match_events,
        // reset_match_results); der Nachtrag per updateMatches war in der Cloud ohne Wirkung und ist entfallen.
        it('A-10 Fall 14: Ergebnis-Änderung beim Speichern → kein updateMatches; die Spielplan-Änderung geht weiter über save', async () => {
            const existingMatch = { id: 'm1', round: 1, field: 1, ...vs(T1, T2), scoreA: 3, scoreB: 1, matchStatus: 'finished' as const };
            mockRepo.get.mockResolvedValue({ id: 'tour-1', matches: [existingMatch] });

            const resetMatch = { ...existingMatch, scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' as const, field: 2 };
            const data = { id: 'tour-1', title: 'Draft', matches: [resetMatch] };

            await service.saveDraft(data);

            expect(mockRepo.updateMatches).not.toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                matches: [expect.objectContaining({ id: 'm1', field: 2 })],
            }));
        });

        it('does NOT call updateMatches when nothing about the result/status changed', async () => {
            const existingMatch = { id: 'm1', round: 1, field: 1, ...vs(T1, T2), scoreA: 3, scoreB: 1, matchStatus: 'finished' as const };
            mockRepo.get.mockResolvedValue({ id: 'tour-1', matches: [existingMatch] });

            const data = { id: 'tour-1', title: 'Renamed Draft', matches: [existingMatch] };

            await service.saveDraft(data);

            expect(mockRepo.updateMatches).not.toHaveBeenCalled();
        });

        it('does NOT call repository.get / updateMatches for a brand-new (id-less) draft', async () => {
            const data = { title: 'Brand New' };

            await service.saveDraft(data);

            expect(mockRepo.get).not.toHaveBeenCalled();
            expect(mockRepo.updateMatches).not.toHaveBeenCalled();
        });
    });

    describe('publish', () => {
        it('should generate schedule, set status to published, and save', async () => {
            // Mock generateFullSchedule return
            const mockSchedule = {
                allMatches: [
                    { id: 'm1', originalTeamA: T1, originalTeamB: T2, ...vs(T1, T2), field: 1 },
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
                    expect.objectContaining({ id: 'm1', slotA: vs(T1, T2).slotA })
                ])
            }));
        });

        // A2 Fixrunde 3 (N1c, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/
        // task-A2-rereview.md): "Erweiterte Bearbeitung" (re-publishing) regenerates the whole
        // schedule. `schedule.allMatches` never carries matchStatus/timer/tiebreaker (the
        // generator's ScheduledMatch type doesn't declare them) -- without preserving them from
        // the previously-saved match (same id), a running match's status would look "changed"
        // (running -> undefined) to matchResultStatusDiff and get reset to 'scheduled' in the
        // cloud, silently ending a helper's live match.
        it('preserves matchStatus/timer/tiebreaker of a RUNNING match across regeneration (does not reset it)', async () => {
            const mockSchedule = {
                allMatches: [
                    { id: 'm1', originalTeamA: T1, originalTeamB: T2, ...vs(T1, T2), field: 1 },
                ],
            };
            (generateFullSchedule as any).mockReturnValue(mockSchedule);

            mockRepo.get.mockResolvedValue({
                id: 'tour-1',
                matches: [
                    {
                        id: 'm1',
                        round: 1,
                        field: 1,
                        ...vs(T1, T2),
                        matchStatus: 'running',
                        timerStartTime: '2026-01-01T10:00:00Z',
                        timerElapsedSeconds: 300,
                    },
                ],
            });

            const data = {
                id: 'tour-1',
                publishedAt: '2026-01-01T09:00:00Z', // republish, not first release
                title: 'Published',
                numberOfFields: 1,
                groups: [{ id: 'g1', name: 'A' }],
                teams: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }],
            };

            const result = await service.publish(data);

            const savedMatch = result.matches.find((m) => m.id === 'm1');
            expect(savedMatch?.matchStatus).toBe('running');
            expect(savedMatch?.timerStartTime).toBe('2026-01-01T10:00:00Z');
            expect(savedMatch?.timerElapsedSeconds).toBe(300);

            // The result/status diff against the (unchanged) previous state must therefore be
            // empty -- no cloud write resets the running match.
            expect(mockRepo.updateMatches).not.toHaveBeenCalled();
        });

        // A2 Fixrunde 4 (B1, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/
        // task-A2-rereview2.md): "Turnier zurücksetzen" in the Wizard sets matchStatus 'scheduled'
        // and clears finishedAt in `data.matches`. publish() must take those from the Wizard
        // match, NOT from the pre-reset repository state -- the LOCAL row is reset correctly.
        // C3a-2b (V4): the cloud payload no longer carries any result/status column at all --
        // the former "… und erreichen die Cloud" half of this test is now its opposite: those
        // columns are deliberately NOT sent (Ersatz-Aussage).
        it('Reset im Wizard + publish: Status/Endzeit bleiben lokal korrekt, gehen bewusst nicht an die Cloud (V4)', async () => {
            const mockSchedule = {
                allMatches: [
                    { id: 'm1', originalTeamA: T1, originalTeamB: T2, ...vs(T1, T2), field: 1 },
                ],
            };
            (generateFullSchedule as any).mockReturnValue(mockSchedule);

            mockRepo.get.mockResolvedValue({
                id: 'tour-1',
                matches: [
                    {
                        id: 'm1',
                        round: 1,
                        field: 1,
                        ...vs(T1, T2),
                        scoreA: 2,
                        scoreB: 1,
                        matchStatus: 'finished',
                        finishedAt: '2026-01-01T10:10:00Z',
                    },
                ],
            });

            const data = {
                id: 'tour-1',
                publishedAt: '2026-01-01T09:00:00Z',
                title: 'Published',
                numberOfFields: 1,
                groups: [{ id: 'g1', name: 'A' }],
                teams: [{ id: 't1', name: 'T1' }, { id: 't2', name: 'T2' }],
                // State after useTournamentWizard#handleResetTournament
                matches: [
                    {
                        id: 'm1',
                        round: 1,
                        field: 1,
                        ...vs(T1, T2),
                        scoreA: undefined,
                        scoreB: undefined,
                        matchStatus: 'scheduled' as const,
                        finishedAt: undefined,
                    },
                ],
            };

            const result = await service.publish(data);

            const savedMatch = result.matches.find((m) => m.id === 'm1');
            expect(savedMatch?.matchStatus).toBe('scheduled');
            expect(savedMatch?.finishedAt ?? null).toBeNull();

            // A-10 Fall 14 (umgeschrieben, vorher 1× updateMatches ohne Wirkung in der Cloud): kein Ergebnis-Nachtrag mehr;
            // das Zurücksetzen in der Cloud macht der Assistent vorher über reset_match_results (useResultsReset).
            expect(mockRepo.updateMatches).not.toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalledTimes(1);
        });
    });
});
