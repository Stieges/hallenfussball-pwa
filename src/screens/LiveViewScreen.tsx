/**
 * LiveViewScreen - Public View via Share-Code
 *
 * URL: /live/:shareCode
 *
 * Features:
 * - Fetches tournament from Supabase using share code
 * - Read-only view for spectators
 * - Respects privacy settings (hideScoresForPublic, hideRankingsForPublic)
 * - "Mein Team" selection (stored in localStorage)
 * - Offline support via service worker caching
 *
 * @see docs/concepts/PUBLIC-PAGE-KONZEPT-v4-FINAL.md
 */

import { useState, useEffect, CSSProperties, useCallback } from 'react';
import { cssVars } from '../design-tokens';
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';
import { isSupabaseConfigured } from '../lib/supabase';

export interface LiveViewScreenProps {
  shareCode: string;
}

// localStorage key for "Mein Team" selection
const getMyTeamStorageKey = (shareCode: string) => `live:${shareCode}:myTeam`;

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({ shareCode }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [currentStandings, setCurrentStandings] = useState<Standing[]>([]);
  const [loadingState, setLoadingState] = useState<'loading' | 'error' | 'not-found' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // "Mein Team" state
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(false);

  // Load "Mein Team" from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(getMyTeamStorageKey(shareCode));
    if (stored) {
      setMyTeamId(stored);
    }
  }, [shareCode]);

  // Save "Mein Team" to localStorage
  const selectMyTeam = useCallback((teamId: string | null) => {
    setMyTeamId(teamId);
    if (teamId) {
      localStorage.setItem(getMyTeamStorageKey(shareCode), teamId);
    } else {
      localStorage.removeItem(getMyTeamStorageKey(shareCode));
    }
    setShowTeamSelector(false);
  }, [shareCode]);

  // Load tournament from Supabase
  useEffect(() => {
    const loadTournament = async () => {
      setLoadingState('loading');
      setErrorMessage(null);

      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        setLoadingState('error');
        setErrorMessage('Cloud-Funktionen sind nicht verfügbar.');
        return;
      }

      try {
        const repository = new SupabaseRepository();
        const found = await repository.getByShareCode(shareCode);

        if (!found) {
          setLoadingState('not-found');
          return;
        }

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
        setLoadingState('success');
      } catch (error) {
        console.error('Error loading tournament:', error);
        setLoadingState('error');
        setErrorMessage('Fehler beim Laden des Turniers');
      }
    };

    void loadTournament();
  }, [shareCode]);

  // Apply privacy filters
  const getFilteredSchedule = (): GeneratedSchedule | null => {
    if (!schedule || !tournament) {
      return null;
    }

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
    if (!tournament) {
      return [];
    }
    return tournament.hideRankingsForPublic ? [] : currentStandings;
  };

  // Get my team's matches (highlighted)
  const getMyTeamName = (): string | null => {
    if (!myTeamId || !tournament) {
      return null;
    }
    const team = tournament.teams.find((t) => t.id === myTeamId);
    return team?.name ?? null;
  };

  // Styles
  const containerStyle: CSSProperties = {
    minHeight: 'var(--min-h-screen)',
    background: `linear-gradient(135deg, ${cssVars.colors.background} 0%, ${cssVars.colors.backgroundDark} 100%)`,
    padding: cssVars.spacing.md,
  };

  const contentStyle: CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.lg,
    textAlign: 'center',
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    marginBottom: cssVars.spacing.xs,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
  };

  const shareCodeBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    letterSpacing: '0.1em',
    marginTop: cssVars.spacing.sm,
  };

  const errorContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.xxl,
  };

  const errorIconStyle: CSSProperties = {
    fontSize: '4rem',
    marginBottom: cssVars.spacing.lg,
  };

  const myTeamBarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const teamSelectorStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.md,
    zIndex: 1000,
  };

  const teamSelectorContentStyle: CSSProperties = {
    background: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.xl,
    padding: cssVars.spacing.lg,
    maxWidth: '400px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'auto',
  };

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={{ ...errorContainerStyle, color: cssVars.colors.textSecondary }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${cssVars.colors.border}`,
                borderTopColor: cssVars.colors.primary,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
                marginBottom: cssVars.spacing.lg,
              }}
            />
            <p>Turnier wird geladen...</p>
            <p style={{ fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.sm }}>
              Code: {shareCode}
            </p>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (loadingState === 'not-found') {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <Card>
            <div style={errorContainerStyle}>
              <div style={errorIconStyle}>🔍</div>
              <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
                Turnier nicht gefunden
              </h2>
              <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
                Der Code <strong>{shareCode}</strong> ist ungültig oder das Turnier wurde nicht freigegeben.
              </p>
              <Button
                variant="secondary"
                onClick={() => window.location.href = '/'}
              >
                Zur Startseite
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <Card>
            <div style={errorContainerStyle}>
              <div style={errorIconStyle}>⚠️</div>
              <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.md }}>
                Fehler beim Laden
              </h2>
              <p style={{ color: cssVars.colors.textMuted, marginBottom: cssVars.spacing.lg }}>
                {errorMessage ?? 'Ein unbekannter Fehler ist aufgetreten.'}
              </p>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Erneut versuchen
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Success - show tournament
  if (!tournament || !schedule) {
    return null;
  }

  const filteredSchedule = getFilteredSchedule();
  const filteredStandings = getFilteredStandings();
  const myTeamName = getMyTeamName();

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
          <div style={shareCodeBadgeStyle}>
            LIVE: {shareCode}
          </div>
        </div>

        {/* "Mein Team" Bar */}
        <div style={myTeamBarStyle}>
          <div>
            <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
              Mein Team:
            </span>{' '}
            <strong style={{ color: cssVars.colors.textPrimary }}>
              {myTeamName ?? 'Nicht ausgewählt'}
            </strong>
          </div>
          <Button
            variant={myTeamId ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setShowTeamSelector(true)}
          >
            {myTeamId ? 'Ändern' : 'Team wählen'}
          </Button>
        </div>

        {/* Team Selector Modal */}
        {showTeamSelector && (
          <div style={teamSelectorStyle} onClick={() => setShowTeamSelector(false)}>
            <div style={teamSelectorContentStyle} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: cssVars.spacing.md, fontSize: cssVars.fontSizes.lg }}>
                Mein Team wählen
              </h3>
              <p style={{ marginBottom: cssVars.spacing.md, color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
                Wähle dein Team, um seine Spiele hervorzuheben.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }}>
                {/* "Kein Team" option */}
                <Button
                  variant={myTeamId === null ? 'primary' : 'secondary'}
                  onClick={() => selectMyTeam(null)}
                  style={{ justifyContent: 'flex-start' }}
                >
                  Kein Team (alle anzeigen)
                </Button>
                {/* Teams */}
                {tournament.teams.map((team) => (
                  <Button
                    key={team.id}
                    variant={myTeamId === team.id ? 'primary' : 'secondary'}
                    onClick={() => selectMyTeam(team.id)}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {team.name}
                    {team.group && (
                      <span style={{ marginLeft: 'auto', color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
                        Gruppe {team.group}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

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

        {/* Footer */}
        <div
          style={{
            marginTop: cssVars.spacing.xxl,
            textAlign: 'center',
            color: cssVars.colors.textMuted,
            fontSize: cssVars.fontSizes.xs,
          }}
        >
          <p>Erstellt mit Hallenfußball-App</p>
        </div>
      </div>
    </div>
  );
};
