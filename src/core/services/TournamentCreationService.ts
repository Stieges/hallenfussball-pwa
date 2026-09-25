import { ITournamentRepository } from '../repositories/ITournamentRepository';
import { Tournament } from '../models/types';
import { generateTournamentId } from '../../utils/idGenerator';
import { getSportConfig, DEFAULT_SPORT_ID } from '../../config/sports';
import { generateFullSchedule } from '../generators';
import { generateShareCode } from '../../utils/shareCode';
import { diffMatchResultStatusUpdates } from './matchResultStatusDiff';

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
            // Keine `label`-Strings hier: core/ darf kein React importieren (useSportTerms
            // ist ein Hook) und deutsche Komposita ("Tor" + "differenz") übersetzen sich
            // ohnehin nicht. Die Anzeige löst über `id` gegen i18n auf
            // (`wizard.json` → `placementLogic.criteria.<id>`), mit Rückfall auf `label`
            // für bereits gespeicherte Turniere ohne passenden Schlüssel.
            placementLogic: [
                { id: 'points', enabled: true },
                { id: 'goalDifference', enabled: true },
                { id: 'goalsFor', enabled: true },
                { id: 'directComparison', enabled: false },
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
            // Ein neuer Entwurf ist privat. Ein Entwurf trägt vorläufige Teamnamen und einen
            // unfertigen Spielplan — er darf erst mit der bewussten Freigabe (publish())
            // öffentlich erreichbar werden. Der Merge unten ist {...base, ...data}, ein
            // explizit übergebener Wert eines bestehenden Turniers gewinnt also weiterhin.
            isPublic: false,
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
                if (!data.date) {
                    errors.push('Startdatum erforderlich');
                } else if (this.isPastDate(data.date)) {
                    errors.push('Startdatum darf nicht in der Vergangenheit liegen');
                }
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
                // F-116: in groupsAndFinals every group must be assigned to ≥1 field.
                // `undefined` means "use all fields" (default), only an explicit empty array is invalid.
                if (data.groupSystem === 'groupsAndFinals' && data.groups) {
                    const hasUnassignedGroup = data.groups.some(
                        g => Array.isArray(g.allowedFieldIds) && g.allowedFieldIds.length === 0
                    );
                    if (hasUnassignedGroup) {
                        errors.push('Jede Gruppe muss mindestens einem Feld zugeordnet sein');
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
                    // F-114: empty/whitespace-only names block save
                    if (data.teams.some(t => !t.name?.trim())) {
                        errors.push('Teamnamen dürfen nicht leer sein');
                    }
                }
                // F-209: team count must match planned numberOfTeams
                if (
                    typeof data.numberOfTeams === 'number' &&
                    Array.isArray(data.teams) &&
                    data.teams.length !== data.numberOfTeams
                ) {
                    errors.push(`Anzahl Teams: ${data.teams.length} von ${data.numberOfTeams} hinzugefügt`);
                }
                break;
        }

        return errors;
    }

    /**
     * A2 Fixrunde 1 (Ruling AJ, I1: `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
     * task-A2-review.md`): `repository.save()` intentionally skips result/status columns for
     * EXISTING matches (A2) -- editing a PUBLISHED tournament in the Wizard can change those
     * (e.g. "Turnier zurücksetzen" in `useTournamentWizard.ts` clears score/status/finishedAt).
     * Fetches the pre-save state (only when editing an existing tournament) and persists any
     * result/status change via a targeted update, same pattern as `DangerZone`/`useCorrectionMode`.
     * Wrapped in try/catch: a failure here must never block the actual save that already
     * succeeded above -- worst case the result/status change stays local-only, exactly the A2 gap
     * this closes, not a new failure mode.
     */
    private async persistResultStatusChanges(tournamentId: string, previous: Tournament | null, next: Tournament): Promise<void> {
        if (!previous) { return; }
        try {
            const updates = diffMatchResultStatusUpdates(previous.matches, next.matches);
            if (updates.length > 0) {
                await this.repository.updateMatches(tournamentId, updates);
            }
        } catch (err) {
            console.error('Failed to persist result/status changes after save:', err);
        }
    }

    /**
     * Saves the current draft state
     */
    async saveDraft(data: Partial<Tournament>): Promise<Tournament> {
        const previous = data.id ? await this.repository.get(data.id) : null;
        const tournament = this.createDraft(data, data.id);
        tournament.updatedAt = new Date().toISOString();
        await this.repository.save(tournament);
        await this.persistResultStatusChanges(tournament.id, previous, tournament);
        return tournament;
    }

    /**
     * Publishes the tournament (generates schedule and sets status)
     */
    async publish(data: Partial<Tournament>): Promise<Tournament> {
        const previous = data.id ? await this.repository.get(data.id) : null;
        const tournament = this.createDraft(data, data.id);

        // Veröffentlichen IST die Freigabe — aber nur beim ersten Mal. "Erweiterte Bearbeitung"
        // ruft publish() beim Speichern erneut auf; ohne diesen Guard würde ein bewusst privat
        // gestelltes Turnier hinter dem Rücken des Veranstalters wieder geteilt.
        // Geprüft wird `publishedAt`, NICHT `status`: status 'draft' ist ein transienter
        // Wizard-Marker (SettingsTab.tsx) und sagt nichts über die Freigabe aus.
        const isFirstRelease = !data.publishedAt;
        if (isFirstRelease) {
            tournament.isPublic = true;
            tournament.publishedAt = new Date().toISOString();
        }

        // Generate share code if public and no share code exists
        if (tournament.isPublic && !tournament.shareCode) {
            tournament.shareCode = generateShareCode();
            tournament.shareCodeCreatedAt = new Date().toISOString();
        }

        // Generate full schedule
        const schedule = generateFullSchedule(tournament);

        // A2 Fixrunde 3 (N1c, `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
        // task-A2-rereview.md`): "Erweiterte Bearbeitung" (re-publishing an already-published
        // tournament) regenerates the WHOLE schedule -- `schedule.allMatches` never carries
        // matchStatus/timer/tiebreaker fields (see `ScheduledMatch`, which doesn't declare them).
        // Without this, `persistResultStatusChanges()` below would see e.g. a running match's
        // `matchStatus` go from `'running'` (in `previous`, the real DB state) to `undefined` (in
        // the freshly regenerated match) and reset it -- silently ending a helper's live match
        // from the cloud's point of view, just because the owner re-published the wizard. Carrying
        // these fields over (by match id, from the DB state fetched above) means the diff sees NO
        // change for matches whose id survives regeneration, so nothing gets touched.
        const previousMatchById = new Map((previous?.matches ?? []).map((m) => [m.id, m]));
        // A2 Fixrunde 4 (B1, `task-A2-rereview2.md`): the Wizard's own match (same id) wins over
        // `previous` whenever it carries an explicit `matchStatus` -- that is the Wizard stating
        // the status itself (e.g. "Turnier zurücksetzen" sets 'scheduled' and clears finishedAt,
        // `useTournamentWizard#handleResetTournament`). Taking `previous` there left the cloud at
        // match_status='finished' + actual_end while the scores became NULL. Only when the Wizard
        // has no such match or never stated a status do we fall back to `previous` (N1c: a match a
        // helper started after the Wizard loaded its copy stays protected).
        const wizardMatchById = new Map((data.matches ?? []).map((m) => [m.id, m]));

        // Convert ScheduledMatch to domain Match
        tournament.matches = schedule.allMatches.map((scheduledMatch, index) => {
            const base = {
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
            };

            const wizardMatch = wizardMatchById.get(scheduledMatch.id);
            const statusSource = wizardMatch?.matchStatus !== undefined
                ? wizardMatch
                : previousMatchById.get(scheduledMatch.id);
            if (!statusSource) {
                return base;
            }

            return {
                ...base,
                matchStatus: statusSource.matchStatus,
                finishedAt: statusSource.finishedAt,
                timerStartTime: statusSource.timerStartTime,
                timerPausedAt: statusSource.timerPausedAt,
                timerElapsedSeconds: statusSource.timerElapsedSeconds,
                overtimeScoreA: statusSource.overtimeScoreA,
                overtimeScoreB: statusSource.overtimeScoreB,
                penaltyScoreA: statusSource.penaltyScoreA,
                penaltyScoreB: statusSource.penaltyScoreB,
                decidedBy: statusSource.decidedBy,
                skippedReason: statusSource.skippedReason,
                skippedAt: statusSource.skippedAt,
            };
        });

        // Important: scheduledTime in Match interface is likely Date or string?
        // In LiveMatch, it was string? 
        // Let's check src/types/tournament.ts for Match interface.
        // Assuming Date is correct based on generator logic.

        tournament.status = 'published';
        tournament.updatedAt = new Date().toISOString();

        await this.repository.save(tournament);
        await this.persistResultStatusChanges(tournament.id, previous, tournament);
        return tournament;
    }

    /**
     * F-113: Compares an ISO date string (YYYY-MM-DD) against today's local date.
     * Returns true if the given date is strictly before today.
     */
    private isPastDate(isoDate: string): boolean {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
            return false;
        }
        const today = new Date();
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return isoDate < todayIso;
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
