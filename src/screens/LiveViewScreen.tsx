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

import { useState, CSSProperties, useCallback, useRef, TouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, layoutHeights } from '../design-tokens';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { GroupTables } from '../components/schedule/GroupTables';
import { formatDateGerman } from '../utils/locationHelpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PublicBottomNav } from '../components/ui/PublicBottomNav';
import { usePublicTournament } from '../features/public-view/usePublicTournament';
import { usePublicViewFilters } from '../features/public-view/usePublicViewFilters';
import {
  publicSchedule,
  publicMatches,
  visibleStandings,
  uniqueGroups,
  myTeamName,
} from '../features/public-view/publicScheduleFilters';
import { useTheme } from '../hooks/useTheme';
import { useHaptic } from '../hooks/useHaptic';
import { BaseThemeSelector } from '../features/settings/components/BaseThemeSelector';

export interface LiveViewScreenProps {
  shareCode: string;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({ shareCode }) => {
  const { t: tSport } = useTranslation('sport');
  const { tournament, schedule, standings: currentStandings, loadingState, errorMessage, refresh } =
    usePublicTournament(shareCode);

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

  // URL-Zustand, Filter, Tab und „Mein Team“ (Hook, B-13c)
  const {
    filters,
    activeTab,
    showTeamSelector,
    setShowTeamSelector,
    handleGroupChange,
    handlePhaseChange,
    handleStatusChange,
    handleTabChange,
    handleShowOnlyMyTeamChange,
    selectMyTeam,
  } = usePublicViewFilters(shareCode);
  const { showOnlyMyTeam, myTeamId, selectedGroup, selectedPhase, selectedStatus } = filters;


  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    // Only trigger if at top of scroll
    if (containerRef.current?.scrollTop === 0) {
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
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      const dampenedDistance = Math.min(diff * 0.5, 120);
      setPullDistance(dampenedDistance);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      triggerHaptic('medium');
      setIsRefreshing(true);
      setPullDistance(0);
      void refresh().then(() => {
        triggerHaptic('success');
        setIsRefreshing(false);
      });
    } else {
      setPullDistance(0);
    }
    pullStartY.current = null;
  }, [pullDistance, isRefreshing, refresh, triggerHaptic]);

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

  const filteredSchedule = publicSchedule(schedule, tournament, filters);
  const filteredStandings = visibleStandings(tournament, currentStandings);
  const myTeamLabel = myTeamName(tournament, myTeamId);
  const groups = uniqueGroups(tournament);

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
                {myTeamLabel ?? 'Nicht ausgewählt'}
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
          {groups.length > 1 && (
            <div style={filterRowStyle}>
              <span style={filterLabelStyle}>Gruppe:</span>
              <button
                style={chipStyle(selectedGroup === null)}
                onClick={() => handleGroupChange(null)}
              >
                Alle
              </button>
              {groups.map((group) => (
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
              {tSport('tournament.groupStage')}
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
                currentMatches={publicMatches(tournament)}
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
