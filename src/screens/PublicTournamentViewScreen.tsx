/**
 * PublicTournamentViewScreen - Öffentliche Readonly-Ansicht für Zuschauer
 *
 * Features:
 * - Lädt Turnier aus Supabase (für externe Zuschauer)
 * - Fallback auf localStorage (für lokale Entwicklung)
 * - Respektiert Privacy-Settings (hideScoresForPublic, hideRankingsForPublic)
 * - Readonly ScheduleDisplay
 * - Share & PDF Export Buttons
 */

import { useState, useEffect, CSSProperties } from 'react';
import { cssVars } from '../design-tokens'
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { ScheduleActionButtons } from '../components/ScheduleActionButtons';
import { Card } from '../components/ui/Card';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';

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

  // Load tournament - try Supabase first, fallback to localStorage
  useEffect(() => {
    const loadFromSupabase = async (): Promise<Tournament | null> => {
      if (!isSupabaseConfigured || !supabase) {
        return null;
      }

      try {
        // Use SupabaseRepository for proper mapping
        const repo = new SupabaseRepository();

        // First try as share code (6 chars alphanumeric)
        if (/^[A-Z0-9]{6}$/i.test(tournamentId)) {
          const tournament = await repo.getByShareCode(tournamentId.toUpperCase());
          if (tournament) {
            return tournament;
          }
        }

        // Then try as tournament ID (UUID or other format)
        const tournament = await repo.get(tournamentId);
        return tournament;
      } catch (error) {
        console.error('[PublicTournamentView] Supabase load failed:', error);
        return null;
      }
    };

    const loadFromLocalStorage = (): Tournament | null => {
      try {
        const stored = localStorage.getItem('tournaments');
        if (!stored) {return null;}

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any; validated by usage
        const tournaments: Tournament[] = JSON.parse(stored);
        return tournaments.find((t) => t.id === tournamentId) ?? null;
      } catch {
        return null;
      }
    };

    const processLoadedTournament = (found: Tournament) => {
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
    };

    const loadTournament = async () => {
      try {
        // Try Supabase first (for external visitors)
        let found = await loadFromSupabase();

        // Fallback to localStorage (for local development or offline)
        found ??= loadFromLocalStorage();

        if (found) {
          processLoadedTournament(found);
        } else {
          setLoadingError('Turnier nicht gefunden');
        }
      } catch (error) {
        console.error('Error loading tournament:', error);
        setLoadingError('Fehler beim Laden des Turniers');
      }
    };

    void loadTournament();
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
