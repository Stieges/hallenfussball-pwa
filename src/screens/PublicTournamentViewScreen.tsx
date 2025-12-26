/**
 * PublicTournamentViewScreen - Öffentliche Readonly-Ansicht für Zuschauer
 *
 * Features:
 * - Lädt Turnier aus localStorage basierend auf ID
 * - Respektiert Privacy-Settings (hideScoresForPublic, hideRankingsForPublic)
 * - Readonly ScheduleDisplay
 * - Share & PDF Export Buttons
 */

import { useState, useEffect, CSSProperties } from 'react';
import { colors, fontSizes, fontWeights, spacing } from '../design-tokens';
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../lib/scheduleGenerator';
import { calculateStandings } from '../utils/calculations';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { ScheduleActionButtons } from '../components/ScheduleActionButtons';
import { Card } from '../components/ui/Card';

export interface PublicTournamentViewScreenProps {
  tournamentId: string;
}

export const PublicTournamentViewScreen: React.FC<PublicTournamentViewScreenProps> = ({
  tournamentId,
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [currentStandings, setCurrentStandings] = useState<Standing[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Load tournament from localStorage
  useEffect(() => {
    const loadTournament = () => {
      try {
        const stored = localStorage.getItem('tournaments');

        if (!stored) {
          setLoadingError('Turnier nicht gefunden');
          return;
        }

        const tournaments: Tournament[] = JSON.parse(stored);
        const found = tournaments.find((t) => t.id === tournamentId);

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
              found.matches || [],
              found,
              group
            );
            allStandings.push(...groupStandings);
          });

          setCurrentStandings(allStandings);
        } else {
          setLoadingError('Turnier nicht gefunden');
        }
      } catch (error) {
        console.error('Error loading tournament:', error);
        setLoadingError('Fehler beim Laden des Turniers');
      }
    };

    loadTournament();
  }, [tournamentId]);

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
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${colors.background} 0%, #0d1d35 100%)`,
    padding: spacing.xl,
  };

  const contentStyle: CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    marginBottom: spacing.xl,
    textAlign: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  };

  const errorStyle: CSSProperties = {
    textAlign: 'center',
    padding: spacing.xxl,
    color: colors.error,
    fontSize: fontSizes.lg,
  };

  const loadingStyle: CSSProperties = {
    textAlign: 'center',
    padding: spacing.xxl,
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
  };

  // Error state
  if (loadingError) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <Card>
            <div style={errorStyle}>
              <h2>❌ {loadingError}</h2>
              <p style={{ marginTop: spacing.md, color: colors.textMuted }}>
                Das Turnier konnte nicht gefunden werden oder wurde noch nicht freigegeben.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Loading state
  if (!tournament || !schedule) {
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
            currentMatches={tournament.matches || []}
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
              marginTop: spacing.xl,
              textAlign: 'center',
              color: colors.textMuted,
              fontSize: fontSizes.sm,
            }}
          >
            <p>
              {tournament.hideScoresForPublic && 'Spielstände werden nicht angezeigt. '}
              {tournament.hideRankingsForPublic && 'Tabellen werden nicht angezeigt.'}
            </p>
            <p style={{ marginTop: spacing.xs }}>
              (Bambini-Modus aktiviert)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
