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
import { cssVars } from '../design-tokens';
import { ScheduleDisplay } from '../components/ScheduleDisplay';
import { formatDateGerman } from '../utils/locationHelpers';
import { Card } from '../components/ui/Card';
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
  standingsTabAvailable,
  effectiveNavTab,
} from '../features/public-view/publicScheduleFilters';
import { useTheme } from '../hooks/useTheme';
import { PublicStandingsTab } from '../features/public-view/components/PublicStandingsTab';
import { PublicInfoTab } from '../features/public-view/components/PublicInfoTab';
import { MyTeamBar } from '../features/public-view/components/MyTeamBar';
import { PublicFilterBar } from '../features/public-view/components/PublicFilterBar';
import { TeamSelectorDialog } from '../features/public-view/components/TeamSelectorDialog';

export interface LiveViewScreenProps {
  shareCode: string;
}

export const LiveViewScreen: React.FC<LiveViewScreenProps> = ({ shareCode }) => {
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

  // Tabellen-Tab nur, wenn Stände sichtbar sein dürfen; Direktaufruf fällt auf den Spielplan zurück (W2A-031)
  const tab = effectiveNavTab(activeTab, tournament);
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
        {tab === 'schedule' && (
          <MyTeamBar
            myTeamLabel={myTeamLabel}
            myTeamId={myTeamId}
            showOnlyMyTeam={showOnlyMyTeam}
            onShowOnlyMyTeamChange={handleShowOnlyMyTeamChange}
            onOpenTeamSelector={() => setShowTeamSelector(true)}
          />
        )}

        {/* Filter Bar - only on schedule tab */}
        {tab === 'schedule' && (
          <PublicFilterBar
            groups={groups}
            selectedGroup={selectedGroup}
            selectedPhase={selectedPhase}
            selectedStatus={selectedStatus}
            onGroupChange={handleGroupChange}
            onPhaseChange={handlePhaseChange}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Team Selector Modal */}
        {showTeamSelector && (
          <TeamSelectorDialog
            teams={tournament.teams}
            myTeamId={myTeamId}
            onSelectTeam={selectMyTeam}
            onClose={() => setShowTeamSelector(false)}
          />
        )}

        {/* Tab Content */}
        {tab === 'schedule' && (
          <>
            {/* Schedule Display */}
            <Card>
              <ScheduleDisplay
                schedule={filteredSchedule}
                currentStandings={filteredStandings}
                showGroupTables={standingsTabAvailable(tournament)}
                participantStandings={tournament.hideScoresForPublic ? schedule.initialStandings : undefined}
                currentMatches={publicMatches(tournament)}
                tournamentTeams={tournament.teams}
                editable={false}
              />
            </Card>
          </>
        )}

        {tab === 'standings' && (
          <PublicStandingsTab tournament={tournament} standings={currentStandings} />
        )}

        {tab === 'settings' && (
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
      <PublicBottomNav
        activeTab={tab}
        onTabChange={handleTabChange}
        hiddenTabs={standingsTabAvailable(tournament) ? [] : ['standings']}
      />
    </div>
  );
};
