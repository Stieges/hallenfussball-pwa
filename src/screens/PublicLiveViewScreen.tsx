/**
 * PublicLiveViewScreen - Öffentliche Readonly-Ansicht für Zuschauer via Share-Code
 *
 * Features:
 * - Lädt Turnier aus Supabase basierend auf Share-Code
 * - Respektiert Privacy-Settings (hideScoresForPublic, hideRankingsForPublic)
 * - Readonly ScheduleDisplay
 * - Auto-Refresh (Poling / Subscription) - Phase 2
 */

import React, { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../design-tokens'
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { ScheduleActionButtons } from '../components/ScheduleActionButtons';
import { Card } from '../components/ui/Card';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';
import { isSupabaseConfigured } from '../lib/supabase';

export interface PublicLiveViewScreenProps {
    shareCode: string;
}

export const PublicLiveViewScreen: React.FC<PublicLiveViewScreenProps> = ({
    shareCode,
}) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
    const [currentStandings, setCurrentStandings] = useState<Standing[]>([]);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load tournament from Supabase
    useEffect(() => {
        const loadTournament = async () => {
            setIsLoading(true);
            setLoadingError(null);

            if (!isSupabaseConfigured) {
                setLoadingError('Verbindung zum Server nicht konfiguriert.');
                setIsLoading(false);
                return;
            }

            try {
                const repo = new SupabaseRepository();
                const found = await repo.getByShareCode(shareCode);

                if (found) {
                    setTournament(found);

                    // Generate schedule
                    const generatedSchedule = generateFullSchedule(found);
                    setSchedule(generatedSchedule);

                    // Calculate standings
                    const uniqueGroups = Array.from(
                        new Set(found.teams.map((t) => t.group).filter(Boolean))
                    ) as string[];

                    const allStandings: Standing[] = [];
                    uniqueGroups.forEach((group) => {
                        const teamsInGroup = found.teams.filter((t) => t.group === group);
                        const groupStandings = calculateStandings(
                            teamsInGroup,
                            found.matches,
                            found,
                            group
                        );
                        allStandings.push(...groupStandings);
                    });

                    setCurrentStandings(allStandings);
                } else {
                    setLoadingError('Turnier nicht gefunden oder Code ungültig');
                }
            } catch (error) {
                console.error('Error loading tournament:', error);
                setLoadingError('Fehler beim Laden des Turniers');
            } finally {
                setIsLoading(false);
            }
        };

        void loadTournament();
    }, [shareCode]);

    // Apply privacy filters
    const getFilteredSchedule = (): GeneratedSchedule | null => {
        if (!schedule || !tournament) {return null;}

        // Filter scores if hideScoresForPublic is enabled
        if (tournament.hideScoresForPublic) {
            return {
                ...schedule,
                allMatches: schedule.allMatches.map((match) => ({
                    ...match,
                    scoreA: undefined,
                    scoreB: undefined,
                })),
                phases: schedule.phases.map((phase) => ({
                    ...phase,
                    matches: phase.matches.map((match) => ({
                        ...match,
                        scoreA: undefined,
                        scoreB: undefined,
                    })),
                })),
            };
        }

        return schedule;
    };

    // Filter standings if hideRankingsForPublic is enabled
    const getFilteredStandings = (): Standing[] => {
        if (!tournament) {return [];}
        return tournament.hideRankingsForPublic ? [] : currentStandings;
    };

    const containerStyle: CSSProperties = {
        minHeight: 'var(--min-h-screen)',
        background: `linear-gradient(135deg, ${cssVars.colors.background} 0%, ${cssVars.colors.backgroundDark} 100%)`,
        padding: cssVars.spacing.xl,
    };

    const contentStyle: CSSProperties = {
        maxWidth: '1400px',
        margin: '0 auto',
    };

    const headerStyle: CSSProperties = {
        marginBottom: cssVars.spacing.xl,
        textAlign: 'center',
    };

    const titleStyle: CSSProperties = {
        fontSize: cssVars.fontSizes.xxxl,
        fontWeight: cssVars.fontWeights.bold,
        color: cssVars.colors.textPrimary,
        marginBottom: cssVars.spacing.sm,
    };

    const subtitleStyle: CSSProperties = {
        fontSize: cssVars.fontSizes.lg,
        color: cssVars.colors.textSecondary,
    };

    const errorStyle: CSSProperties = {
        textAlign: 'center',
        padding: cssVars.spacing.xxl,
        color: cssVars.colors.error,
        fontSize: cssVars.fontSizes.lg,
    };

    const loadingStyle: CSSProperties = {
        textAlign: 'center',
        padding: cssVars.spacing.xxl,
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.lg,
    };

    // Error state
    if (loadingError) {
        return (
            <div style={containerStyle}>
                <div style={contentStyle}>
                    <Card>
                        <div style={errorStyle}>
                            <h2>❌ {loadingError}</h2>
                            <p style={{ marginTop: cssVars.spacing.md, color: cssVars.colors.textMuted }}>
                                Der Code "{shareCode}" ist ungültig oder das Turnier wurde beendet.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoading || !tournament || !schedule) {
        return (
            <div style={containerStyle}>
                <div style={contentStyle}>
                    <div style={loadingStyle}>Turnier wird geladen...</div>
                </div>
            </div>
        );
    }

    const filteredSchedule = getFilteredSchedule();
    const filteredStandings = getFilteredStandings();

    if (!filteredSchedule) {
        return null;
    }

    return (
        <div style={containerStyle}>
            <div style={contentStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <h1 style={titleStyle}>{tournament.title}</h1>
                    <p style={subtitleStyle}>
                        {tournament.ageClass} • {formatDateGerman(tournament.date)}
                    </p>
                </div>

                {/* Schedule Display */}
                <Card>
                    <ScheduleDisplay
                        schedule={filteredSchedule}
                        currentStandings={filteredStandings}
                        currentMatches={tournament.matches}
                        tournamentTeams={tournament.teams}
                        editable={false}
                    />
                </Card>

                {/* Action Buttons (FAB style on mobile) */}
                <ScheduleActionButtons
                    tournament={tournament}
                    schedule={schedule}
                    standings={currentStandings}
                    variant="public"
                />

                {/* Privacy Notice (if scores/rankings are hidden) */}
                {(tournament.hideScoresForPublic || tournament.hideRankingsForPublic) && (
                    <div
                        style={{
                            marginTop: cssVars.spacing.xl,
                            textAlign: 'center',
                            color: cssVars.colors.textMuted,
                            fontSize: cssVars.fontSizes.sm,
                        }}
                    >
                        <p>
                            {tournament.hideScoresForPublic && 'Spielstände werden nicht angezeigt. '}
                            {tournament.hideRankingsForPublic && 'Tabellen werden nicht angezeigt.'}
                        </p>
                        <p style={{ marginTop: cssVars.spacing.xs }}>
                            (Bambini-Modus aktiviert)
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicLiveViewScreen;
