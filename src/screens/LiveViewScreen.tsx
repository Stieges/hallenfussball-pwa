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

import { useState, useEffect, CSSProperties, useCallback, useRef, TouchEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cssVars, layoutHeights } from '../design-tokens';
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule } from '../core/generators';
import { calculateStandings } from '../utils/calculations';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { GroupTables } from '../components/schedule/GroupTables';
import { formatDateGerman } from '../utils/locationHelpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PublicBottomNav, PublicNavTab } from '../components/ui/PublicBottomNav';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';
import { isSupabaseConfigured } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { useHaptic } from '../hooks/useHaptic';
import { BaseThemeSelector } from '../features/settings/components/BaseThemeSelector';

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

  // Theme hook
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Haptic feedback hook
  const { triggerHaptic } = useHaptic();

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80; // Minimum pull distance to trigger refresh

  // URL search params for deep-linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial filter values from URL
  const urlGroup = searchParams.get('g');
  const urlPhase = searchParams.get('p') as 'all' | 'groupStage' | 'final' | null;
  const urlStatus = searchParams.get('s') as 'all' | 'scheduled' | 'live' | 'finished' | null;
  const urlTab = searchParams.get('tab') as PublicNavTab | null;
  const urlMyTeamOnly = searchParams.get('my') === '1';

  // "Mein Team" state
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [showOnlyMyTeam, setShowOnlyMyTeam] = useState(urlMyTeamOnly);

  // Filter state - initialized from URL
  const [selectedGroup, setSelectedGroup] = useState<string | null>(urlGroup);
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'groupStage' | 'final'>(urlPhase ?? 'all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'scheduled' | 'live' | 'finished'>(urlStatus ?? 'all');

  // Bottom nav tab state - initialized from URL
  const [activeTab, setActiveTab] = useState<PublicNavTab>(urlTab ?? 'schedule');

  // Update URL when filters change
  const updateUrlParams = useCallback((params: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === 'all' || value === 'schedule' || (key === 'my' && value === '0')) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper functions to update state AND URL (with haptic feedback)
  const handleGroupChange = useCallback((group: string | null) => {
    triggerHaptic('selection');
    setSelectedGroup(group);
    updateUrlParams({ g: group });
  }, [updateUrlParams, triggerHaptic]);

  const handlePhaseChange = useCallback((phase: 'all' | 'groupStage' | 'final') => {
    triggerHaptic('selection');
    setSelectedPhase(phase);
    updateUrlParams({ p: phase === 'all' ? null : phase });
  }, [updateUrlParams, triggerHaptic]);

  const handleStatusChange = useCallback((status: 'all' | 'scheduled' | 'live' | 'finished') => {
    triggerHaptic('selection');
    setSelectedStatus(status);
    updateUrlParams({ s: status === 'all' ? null : status });
  }, [updateUrlParams, triggerHaptic]);

  const handleTabChange = useCallback((tab: PublicNavTab) => {
    triggerHaptic('medium');
    setActiveTab(tab);
    updateUrlParams({ tab: tab === 'schedule' ? null : tab });
  }, [updateUrlParams, triggerHaptic]);

  const handleShowOnlyMyTeamChange = useCallback((value: boolean) => {
    triggerHaptic('selection');
    setShowOnlyMyTeam(value);
    updateUrlParams({ my: value ? '1' : null });
  }, [updateUrlParams, triggerHaptic]);

  // Load "Mein Team" from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(getMyTeamStorageKey(shareCode));
    if (stored) {
      setMyTeamId(stored);
    }
  }, [shareCode]);

  // Save "Mein Team" to localStorage
  const selectMyTeam = useCallback((teamId: string | null) => {
    triggerHaptic('success');
    setMyTeamId(teamId);
    if (teamId) {
      localStorage.setItem(getMyTeamStorageKey(shareCode), teamId);
    } else {
      localStorage.removeItem(getMyTeamStorageKey(shareCode));
    }
    setShowTeamSelector(false);
  }, [shareCode, triggerHaptic]);

  // Load tournament from Supabase
  const loadTournament = useCallback(async (isRefreshAction = false) => {
    if (!isRefreshAction) {
      setLoadingState('loading');
    }
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
      if (!isRefreshAction) {
        setLoadingState('error');
        setErrorMessage('Fehler beim Laden des Turniers');
      }
    }
  }, [shareCode]);

  // Initial load
  useEffect(() => {
    void loadTournament(false);
  }, [loadTournament]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    // Only trigger if at top of scroll
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null || isRefreshing) {
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY.current;

    // Only pull down, and apply dampening
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      const dampenedDistance = Math.min(diff * 0.5, 120);
      setPullDistance(dampenedDistance);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      triggerHaptic('medium');
      setIsRefreshing(true);
      setPullDistance(0);
      void loadTournament(true).then(() => {
        triggerHaptic('success');
        setIsRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  }, [pullDistance, isRefreshing, loadTournament, triggerHaptic]);

  // Apply privacy filters and user filters
  const getFilteredSchedule = (): GeneratedSchedule | null => {
    if (!schedule || !tournament) {
      return null;
    }

    // First apply user filters
    let result = applyFilters(schedule);

    // Then apply privacy filters (hide scores if needed)
    if (tournament.hideScoresForPublic) {
      result = {
        ...result,
        allMatches: result.allMatches.map((match) => ({
          ...match,
          scoreA: undefined,
          scoreB: undefined,
        })),
        phases: result.phases.map((phase) => ({
          ...phase,
          matches: phase.matches.map((match) => ({
            ...match,
            scoreA: undefined,
            scoreB: undefined,
          })),
        })),
      };
    }

    return result;
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

  // Get unique groups from tournament
  const getUniqueGroups = (): string[] => {
    if (!tournament) {
      return [];
    }
    return Array.from(
      new Set(tournament.teams.map((t) => t.group).filter(Boolean))
    ) as string[];
  };

  // Apply all filters to schedule
  const applyFilters = (sched: GeneratedSchedule): GeneratedSchedule => {
    let filteredMatches = [...sched.allMatches];

    // Filter by "Nur meine Spiele" - use originalTeamA/originalTeamB for team IDs
    if (showOnlyMyTeam && myTeamId) {
      filteredMatches = filteredMatches.filter(
        (m) => m.originalTeamA === myTeamId || m.originalTeamB === myTeamId
      );
    }

    // Filter by group
    if (selectedGroup) {
      filteredMatches = filteredMatches.filter((m) => m.group === selectedGroup);
    }

    // Filter by phase
    if (selectedPhase !== 'all') {
      filteredMatches = filteredMatches.filter((m) => {
        if (selectedPhase === 'groupStage') {
          return m.phase === 'groupStage';
        } else {
          // final phase includes all non-groupStage phases
          return m.phase !== 'groupStage';
        }
      });
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filteredMatches = filteredMatches.filter((m) => {
        // Find the match in tournament.matches for status
        const liveMatch = tournament?.matches.find((tm) => tm.id === m.id);
        const matchStatus = liveMatch?.matchStatus ?? 'scheduled';

        if (selectedStatus === 'finished') {
          return matchStatus === 'finished';
        } else if (selectedStatus === 'live') {
          // UI uses 'live' but MatchStatus uses 'running'
          return matchStatus === 'running';
        } else {
          // scheduled = not running and not finished
          return matchStatus === 'scheduled' || matchStatus === 'waiting';
        }
      });
    }

    // Rebuild phases with filtered matches
    const filteredPhases = sched.phases.map((phase) => ({
      ...phase,
      matches: phase.matches.filter((m) => filteredMatches.some((fm) => fm.id === m.id)),
    })).filter((phase) => phase.matches.length > 0);

    return {
      ...sched,
      allMatches: filteredMatches,
      phases: filteredPhases,
    };
  };

  // Styles
  const containerStyle: CSSProperties = {
    minHeight: 'var(--min-h-screen)',
    background: `linear-gradient(135deg, ${cssVars.colors.background} 0%, ${cssVars.colors.backgroundDark} 100%)`,
    padding: cssVars.spacing.md,
    paddingBottom: `calc(${layoutHeights.bottomNav} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom, 0px))`,
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

  const filterBarStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
  };

  const filterRowStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  const filterLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    minWidth: '60px',
  };

  const chipStyle = (active: boolean): CSSProperties => ({
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: active ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
    background: active ? cssVars.colors.primary : cssVars.colors.surfaceElevated,
    color: active ? cssVars.colors.background : cssVars.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const toggleStyle = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    background: active ? cssVars.colors.primarySubtle : 'transparent',
    color: active ? cssVars.colors.primary : cssVars.colors.textMuted,
    border: `1px solid ${active ? cssVars.colors.primary : cssVars.colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

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

  // Pull-to-refresh indicator style
  const refreshIndicatorStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: `translateX(-50%) translateY(${pullDistance > 0 || isRefreshing ? '0' : '-100%'})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: `${Math.max(pullDistance, isRefreshing ? 60 : 0)}px`,
    width: '100%',
    transition: pullDistance > 0 ? 'none' : 'all 0.3s ease',
    overflow: 'hidden',
  };

  const spinnerStyle: CSSProperties = {
    width: 32,
    height: 32,
    border: `3px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
    transform: isRefreshing ? 'none' : `rotate(${pullDistance * 3}deg)`,
    opacity: pullDistance > 20 || isRefreshing ? 1 : pullDistance / 20,
    transition: isRefreshing ? 'none' : 'opacity 0.1s ease',
  };

  return (
    <div
      ref={containerRef}
      style={{ ...containerStyle, position: 'relative', overflowY: 'auto' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div style={refreshIndicatorStyle}>
        <div style={spinnerStyle} />
        {pullDistance >= PULL_THRESHOLD && !isRefreshing && (
          <span style={{
            marginLeft: cssVars.spacing.sm,
            fontSize: cssVars.fontSizes.sm,
            color: cssVars.colors.textMuted,
          }}>
            Loslassen zum Aktualisieren
          </span>
        )}
      </div>

      <div style={{ ...contentStyle, transform: `translateY(${pullDistance}px)`, transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease' }}>
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

        {/* "Mein Team" Bar - only on schedule tab */}
        {activeTab === 'schedule' && (
          <div style={myTeamBarStyle}>
            <div>
              <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
                Mein Team:
              </span>{' '}
              <strong style={{ color: cssVars.colors.textPrimary }}>
                {myTeamName ?? 'Nicht ausgewählt'}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: cssVars.spacing.sm, alignItems: 'center' }}>
              {myTeamId && (
                <button
                  style={toggleStyle(showOnlyMyTeam)}
                  onClick={() => handleShowOnlyMyTeamChange(!showOnlyMyTeam)}
                >
                  <span>⭐</span>
                  <span>Nur meine</span>
                </button>
              )}
              <Button
                variant={myTeamId ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setShowTeamSelector(true)}
              >
                {myTeamId ? 'Ändern' : 'Team wählen'}
              </Button>
            </div>
          </div>
        )}

        {/* Filter Bar - only on schedule tab */}
        {activeTab === 'schedule' && (
          <div style={filterBarStyle}>
          {/* Group Filter */}
          {getUniqueGroups().length > 1 && (
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Gruppe:</span>
              <button
                style={chipStyle(selectedGroup === null)}
                onClick={() => handleGroupChange(null)}
              >
                Alle
              </button>
              {getUniqueGroups().map((group) => (
                <button
                  key={group}
                  style={chipStyle(selectedGroup === group)}
                  onClick={() => handleGroupChange(group)}
                >
                  Gruppe {group}
                </button>
              ))}
            </div>
          )}

          {/* Phase Filter */}
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Phase:</span>
            <button
              style={chipStyle(selectedPhase === 'all')}
              onClick={() => handlePhaseChange('all')}
            >
              Alle
            </button>
            <button
              style={chipStyle(selectedPhase === 'groupStage')}
              onClick={() => handlePhaseChange('groupStage')}
            >
              Vorrunde
            </button>
            <button
              style={chipStyle(selectedPhase === 'final')}
              onClick={() => handlePhaseChange('final')}
            >
              Finalrunde
            </button>
          </div>

          {/* Status Filter */}
          <div style={filterRowStyle}>
            <span style={filterLabelStyle}>Status:</span>
            <button
              style={chipStyle(selectedStatus === 'all')}
              onClick={() => handleStatusChange('all')}
            >
              Alle
            </button>
            <button
              style={chipStyle(selectedStatus === 'scheduled')}
              onClick={() => handleStatusChange('scheduled')}
            >
              Geplant
            </button>
            <button
              style={chipStyle(selectedStatus === 'live')}
              onClick={() => handleStatusChange('live')}
            >
              🔴 Live
            </button>
            <button
              style={chipStyle(selectedStatus === 'finished')}
              onClick={() => handleStatusChange('finished')}
            >
              Beendet
            </button>
          </div>
        </div>
        )}

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

        {/* Tab Content */}
        {activeTab === 'schedule' && (
          <>
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
          </>
        )}

        {activeTab === 'standings' && (
          <>
            {/* Standings Tab */}
            {tournament.hideRankingsForPublic ? (
              <Card>
                <div
                  style={{
                    padding: cssVars.spacing.xl,
                    textAlign: 'center',
                    color: cssVars.colors.textMuted,
                  }}
                >
                  <p style={{ fontSize: cssVars.fontSizes.lg, marginBottom: cssVars.spacing.sm }}>
                    🏆 Tabellen ausgeblendet
                  </p>
                  <p style={{ fontSize: cssVars.fontSizes.sm }}>
                    (Bambini-Modus aktiviert)
                  </p>
                </div>
              </Card>
            ) : (
              <Card>
                <GroupTables
                  standings={currentStandings}
                  teams={tournament.teams}
                  tournament={tournament}
                />
              </Card>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <>
            {/* Settings/Info Tab */}
            <Card>
              <div style={{ padding: cssVars.spacing.lg }}>
                <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.lg, color: cssVars.colors.textPrimary }}>
                  Turnier-Info
                </h2>

                {/* Tournament Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }}>
                  <div>
                    <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>Name:</span>
                    <p style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary }}>{tournament.title}</p>
                  </div>

                  {tournament.date && (
                    <div>
                      <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>Datum:</span>
                      <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
                        {formatDateGerman(tournament.date)}
                      </p>
                    </div>
                  )}

                  {tournament.location.name && (
                    <div>
                      <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>Ort:</span>
                      <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
                        {tournament.location.name}
                        {tournament.location.city && `, ${tournament.location.city}`}
                      </p>
                    </div>
                  )}

                  <div>
                    <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>Teams:</span>
                    <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
                      {tournament.teams.length} Teams
                    </p>
                  </div>

                  <div>
                    <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>Share-Code:</span>
                    <p style={{
                      fontSize: cssVars.fontSizes.xl,
                      fontWeight: cssVars.fontWeights.bold,
                      color: cssVars.colors.primary,
                      letterSpacing: '0.1em',
                    }}>
                      {shareCode.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Theme Selection */}
            <Card>
              <div style={{ padding: cssVars.spacing.lg }}>
                <h3 style={{
                  fontSize: cssVars.fontSizes.lg,
                  marginBottom: cssVars.spacing.md,
                  color: cssVars.colors.textPrimary,
                }}>
                  Darstellung
                </h3>
                <BaseThemeSelector
                  value={theme}
                  onChange={setTheme}
                  resolvedTheme={resolvedTheme}
                />
              </div>
            </Card>

            {/* Privacy Notice */}
            {(tournament.hideScoresForPublic || tournament.hideRankingsForPublic) && (
              <Card>
                <div
                  style={{
                    padding: cssVars.spacing.lg,
                    background: cssVars.colors.warningLight,
                    borderRadius: cssVars.borderRadius.md,
                  }}
                >
                  <p style={{ color: cssVars.colors.warning, fontWeight: cssVars.fontWeights.medium }}>
                    🔒 Bambini-Modus aktiv
                  </p>
                  <p style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.xs }}>
                    {tournament.hideScoresForPublic && 'Spielstände werden nicht angezeigt. '}
                    {tournament.hideRankingsForPublic && 'Tabellen werden nicht angezeigt.'}
                  </p>
                </div>
              </Card>
            )}
          </>
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

      {/* Bottom Navigation */}
      <PublicBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};
