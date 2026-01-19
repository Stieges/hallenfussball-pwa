import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { generateTournamentId } from '../../utils/idGenerator';
import { getSportConfig, DEFAULT_SPORT_ID } from '../../config/sports';
import { generateFullSchedule } from '../generators';
import { generateShareCode } from '../../utils/shareCode';

export class TournamentCreationService {
    constructor(private readonly repository: ITournamentRepository) { }

    /**
     * Creates a new draft tournament with default values or merges with provided data
     */
    createDraft(data?: Partial<Tournament>, existingId?: string): Tournament {
        const defaultConfig = getSportConfig(data?.sportId ?? DEFAULT_SPORT_ID);
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty id string should use fallback
        const id = data?.id || existingId || generateTournamentId();

        // Default values if not provided
        const base: Partial<Tournament> = {
            sport: 'football',
            sportId: DEFAULT_SPORT_ID,
            tournamentType: 'classic',
            mode: 'classic',
            numberOfFields: defaultConfig.defaults.typicalFieldCount,
            numberOfTeams: 4,
            groupSystem: 'roundRobin',
            numberOfGroups: 2,
            groupPhaseGameDuration: defaultConfig.defaults.gameDuration,
            groupPhaseBreakDuration: defaultConfig.defaults.breakDuration,
            finalRoundGameDuration: defaultConfig.defaults.gameDuration,
            finalRoundBreakDuration: defaultConfig.defaults.breakDuration,
            breakBetweenPhases: 5,
            gamePeriods: defaultConfig.defaults.periods,
            halftimeBreak: defaultConfig.defaults.periodBreak,
            placementLogic: [
                { id: 'points', label: 'Punkte', enabled: true },
                { id: 'goalDifference', label: `${defaultConfig.terminology.goal}differenz`, enabled: true },
                { id: 'goalsFor', label: `Erzielte ${defaultConfig.terminology.goalPlural}`, enabled: true },
                { id: 'directComparison', label: 'Direkter Vergleich', enabled: false },
            ],
            finals: {
                final: false,
                thirdPlace: false,
                fifthSixth: false,
                seventhEighth: false,
            },
            finalsConfig: {
                preset: 'none',
                tiebreaker: defaultConfig.rules.defaultTiebreaker,
                tiebreakerDuration: defaultConfig.rules.defaultTiebreakerDuration,
            },
            refereeConfig: {
                mode: 'none',
            },
            isKidsTournament: false,
            hideScoresForPublic: false,
            hideRankingsForPublic: false,
            resultMode: 'goals',
            pointSystem: defaultConfig.defaults.pointSystem,
            isPublic: true, // Default: Mit Link teilbar
            title: '',
            ageClass: 'U11',
            date: new Date().toISOString().split('T')[0],
            timeSlot: '09:00 - 16:00',
            location: { name: '' },
            teams: [],
            matches: [],
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastVisitedStep: 1,
        };

        // Merge provided data
        return {
            ...base,
            ...data,
            id,
            // Ensure critical fields are set if they were missing in data but present in base
            finalsConfig: { ...base.finalsConfig, ...data?.finalsConfig },
            refereeConfig: { ...base.refereeConfig, ...data?.refereeConfig },
        } as Tournament;
    }

    /**
     * Validates data for a specific wizard step
     */
    validateStep(step: number, data: Partial<Tournament>): string[] {
        const errors: string[] = [];

        switch (step) {
            case 1:
                if (!data.title) { errors.push('Turniername erforderlich'); }
                if (!data.date) { errors.push('Startdatum erforderlich'); }
                if (!data.location?.name) { errors.push('Ort erforderlich'); }
                break;
            case 2:
                if (!data.sport) { errors.push('Sportart erforderlich'); }
                if (!data.tournamentType) { errors.push('Turniertyp erforderlich'); }
                break;
            case 3:
                if (!data.mode) { errors.push('Turniermodus erforderlich'); }
                if (data.refereeConfig?.refereeNames) {
                    const refNames = Object.values(data.refereeConfig.refereeNames);
                    if (this.findDuplicates(refNames).size > 0) {
                        errors.push('Schiedsrichter-Namen müssen eindeutig sein');
                    }
                }
                break;
            case 4:
                if (data.fields) {
                    const fieldNames = data.fields.map(f => f.customName);
                    if (this.findDuplicates(fieldNames).size > 0) {
                        errors.push('Feldnamen müssen eindeutig sein');
                    }
                }
                if (data.groups) {
                    const groupNames = data.groups.map(g => g.customName);
                    if (this.findDuplicates(groupNames).size > 0) {
                        errors.push('Gruppennamen müssen eindeutig sein');
                    }
                }
                break;
            case 5:
                if ((data.teams?.length ?? 0) < 2) {
                    errors.push('Mindestens 2 Teams erforderlich');
                }
                if (data.teams) {
                    const teamNames = data.teams.map(t => t.name);
                    if (this.findDuplicates(teamNames).size > 0) {
                        errors.push('Teamnamen müssen eindeutig sein');
                    }
                }
                break;
        }

        return errors;
    }

    /**
     * Saves the current draft state
     */
    async saveDraft(data: Partial<Tournament>): Promise<Tournament> {
        const tournament = this.createDraft(data, data.id);
        tournament.updatedAt = new Date().toISOString();
        await this.repository.save(tournament);
        return tournament;
    }

    /**
     * Publishes the tournament (generates schedule and sets status)
     */
    async publish(data: Partial<Tournament>): Promise<Tournament> {
        const tournament = this.createDraft(data, data.id);

        // Generate share code if public and no share code exists
        if (tournament.isPublic && !tournament.shareCode) {
            tournament.shareCode = generateShareCode();
            tournament.shareCodeCreatedAt = new Date().toISOString();
        }

        // Generate full schedule
        const schedule = generateFullSchedule(tournament);

        // Convert ScheduledMatch to domain Match
        tournament.matches = schedule.allMatches.map((scheduledMatch, index) => ({
            id: scheduledMatch.id,
            round: Math.floor(index / tournament.numberOfFields) + 1,
            field: scheduledMatch.field,
            slot: scheduledMatch.slot,
            teamA: scheduledMatch.originalTeamA,
            teamB: scheduledMatch.originalTeamB,
            scoreA: scheduledMatch.scoreA,
            scoreB: scheduledMatch.scoreB,
            group: scheduledMatch.group,
            isFinal: scheduledMatch.phase !== 'groupStage',
            phase: scheduledMatch.phase, // BUG-FIX: Save phase for createPhases to work on reload
            finalType: scheduledMatch.finalType,
            label: scheduledMatch.label,
            scheduledTime: scheduledMatch.startTime,
            referee: scheduledMatch.referee,
        }));

        // Important: scheduledTime in Match interface is likely Date or string?
        // In LiveMatch, it was string? 
        // Let's check src/types/tournament.ts for Match interface.
        // Assuming Date is correct based on generator logic.

        tournament.status = 'published';
        tournament.updatedAt = new Date().toISOString();

        await this.repository.save(tournament);
        return tournament;
    }

    private findDuplicates(items: (string | undefined)[]): Set<string> {
        const names = items
            .map(name => name?.trim().toLowerCase())
            .filter((name): name is string => !!name && name.length > 0);
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        names.forEach(name => {
            if (seen.has(name)) { duplicates.add(name); }
            seen.add(name);
        });
        return duplicates;
    }
}
