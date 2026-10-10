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

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../design-tokens';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PublicBottomNav } from '../components/ui/PublicBottomNav';
import { usePublicTournament } from '../features/public-view/usePublicTournament';
import { usePublicViewFilters } from '../features/public-view/usePublicViewFilters';
import { usePullToRefresh, getRefreshIndicatorStyle, getRefreshSpinnerStyle, PULL_THRESHOLD } from '../features/public-view/usePullToRefresh';
import { publicPageContainerStyle, publicPageContentStyle } from '../features/public-view/publicPageStyles';
import { PublicLoadingView, PublicNotFoundView, PublicErrorView } from '../features/public-view/components/PublicStatusViews';
import {
  publicSchedule,
  publicMatches,
  visibleStandings,
  uniqueGroups,
  myTeamName,
} from '../features/public-view/publicScheduleFilters';
import { useTheme } from '../hooks/useTheme';
import { PublicStandingsTab } from '../features/public-view/components/PublicStandingsTab';
import { PublicInfoTab } from '../features/public-view/components/PublicInfoTab';

export interface LiveViewScreenProps {
  shareCode: string;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({ shareCode }) => {
  const { t: tSport } = useTranslation('sport');
  const { tournament, schedule, standings: currentStandings, loadingState, errorMessage, refresh } =
    usePublicTournament(shareCode);

  // Theme hook
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Pull-to-refresh (B-13d1)
  const { containerRef, isRefreshing, pullDistance, handlers: pullHandlers } = usePullToRefresh(refresh);

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


  // Styles
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

  // Zustandsansichten (B-13d1)
  if (loadingState === 'loading') {
    return <PublicLoadingView shareCode={shareCode} />;
  }
  if (loadingState === 'not-found') {
    return <PublicNotFoundView shareCode={shareCode} />;
  }
  if (loadingState === 'error') {
    return <PublicErrorView errorMessage={errorMessage} />;
  }

  // Success - show tournament
  if (!tournament || !schedule) {
    return null;
  }

  const filteredSchedule = publicSchedule(schedule, tournament, filters);
  const filteredStandings = visibleStandings(tournament, currentStandings);
  const myTeamLabel = myTeamName(tournament, myTeamId);
  const groups = uniqueGroups(tournament);

  return (
    <div
      ref={containerRef}
      style={{ ...publicPageContainerStyle, position: 'relative', overflowY: 'auto' }}
      onTouchStart={pullHandlers.onTouchStart}
      onTouchMove={pullHandlers.onTouchMove}
      onTouchEnd={pullHandlers.onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div style={getRefreshIndicatorStyle(pullDistance, isRefreshing)}>
        <div style={getRefreshSpinnerStyle(pullDistance, isRefreshing)} />
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

      <div style={{ ...publicPageContentStyle, transform: `translateY(${pullDistance}px)`, transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease' }}>
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
          <PublicStandingsTab tournament={tournament} standings={currentStandings} />
        )}

        {activeTab === 'settings' && (
          <PublicInfoTab
            tournament={tournament}
            shareCode={shareCode}
            theme={theme}
            setTheme={setTheme}
            resolvedTheme={resolvedTheme}
          />
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
