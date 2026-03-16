/**
 * DashboardCategory - Admin Center Dashboard
 *
 * Quick overview of tournament status, stats, and quick actions.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.1
 */

import { useMemo, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament, Match } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface DashboardCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.lg,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.lg,
  } as CSSProperties,

  statusBannerLive: {
    background: cssVars.colors.successLight,
    border: `1px solid ${cssVars.colors.successHover}`,
  } as CSSProperties,

  statusBannerActive: {
    background: cssVars.colors.primarySubtle,
    border: `1px solid ${cssVars.colors.primaryBorder}`,
  } as CSSProperties,

  statusBannerDraft: {
    background: cssVars.colors.surfaceHover,
    border: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  statusBannerCompleted: {
    background: cssVars.colors.infoLight,
    border: `1px solid ${cssVars.colors.infoBorder}`,
  } as CSSProperties,

  statusInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    animation: 'pulse 2s ease-in-out infinite',
  } as CSSProperties,

  statusText: {
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
  } as CSSProperties,

  statusSubtext: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
    marginTop: 2,
  } as CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: cssVars.spacing.md,
    marginBottom: cssVars.spacing.lg,
  } as CSSProperties,

  statCard: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.md,
    textAlign: 'center',
  } as CSSProperties,

  statLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  statValue: {
    fontSize: cssVars.fontSizes.headlineMd,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  statSubvalue: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textMuted,
    marginTop: 2,
  } as CSSProperties,

  progressBar: {
    height: 6,
    background: cssVars.colors.surfaceHover,
    borderRadius: cssVars.borderRadius.full,
    marginTop: cssVars.spacing.sm,
    overflow: 'hidden',
  } as CSSProperties,

  progressFill: {
    height: '100%',
    background: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.full,
    transition: 'width 0.3s ease',
  } as CSSProperties,

  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left',
  } as CSSProperties,

  actionIcon: {
    fontSize: 20,
    flexShrink: 0,
  } as CSSProperties,

  nextMatchCard: {
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  nextMatchHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  nextMatchLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as CSSProperties,

  nextMatchTime: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.primary,
    fontWeight: cssVars.fontWeights.medium,
  } as CSSProperties,

  nextMatchTeams: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
  } as CSSProperties,

  nextMatchVs: {
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.bodySm,
  } as CSSProperties,

  nextMatchField: {
    textAlign: 'center',
    marginTop: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  runningMatchesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  runningMatchItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    background: cssVars.colors.successLight,
    border: `1px solid ${cssVars.colors.successHover}`,
    borderRadius: cssVars.borderRadius.md,
  } as CSSProperties,

  runningMatchTeams: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
  } as CSSProperties,

  runningMatchScore: {
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.success,
  } as CSSProperties,

  runningMatchField: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,
} as const;

// =============================================================================
// HELPERS
// =============================================================================

function getTeamName(tournament: Tournament, teamId: string, unknownLabel: string): string {
  const team = tournament.teams.find(t => t.id === teamId);
  return team?.name ?? unknownLabel;
}

function getFieldName(tournament: Tournament, fieldNumber: number): string {
  // Fields array uses string IDs like 'field-1', 'field-2'
  const fieldId = `field-${fieldNumber}`;
  const field = tournament.fields?.find(f => f.id === fieldId);
  return field?.customName ?? field?.defaultName ?? `Feld ${fieldNumber}`;
}

function formatTime(date: Date | undefined): string {
  if (!date) {return '';}
  try {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DashboardCategory({
  tournamentId,
  tournament,
}: DashboardCategoryProps) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();

  // Calculate stats
  const stats = useMemo(() => {
    const totalMatches = tournament.matches.length;
    const completedMatches = tournament.matches.filter(
      (m) => m.matchStatus === 'finished'
    ).length;
    const runningMatches = tournament.matches.filter(
      (m) => m.matchStatus === 'running'
    );
    const scheduledMatches = tournament.matches.filter(
      (m) => m.matchStatus === 'scheduled'
    );

    // Calculate total goals
    const totalGoals = tournament.matches.reduce(
      (sum, m) => sum + (m.scoreA ?? 0) + (m.scoreB ?? 0),
      0
    );

    // Find next scheduled match (sort by slot, then by scheduledTime)
    const sortedScheduled = scheduledMatches.sort((a, b) => {
      const aSlot = a.slot ?? 0;
      const bSlot = b.slot ?? 0;
      return aSlot - bSlot;
    });
    const nextMatch = sortedScheduled.length > 0 ? sortedScheduled[0] : null;

    // Calculate progress
    const progress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

    // Determine status
    const isLive = runningMatches.length > 0;
    const isCompleted = completedMatches === totalMatches && totalMatches > 0;
    const isDraft = tournament.status === 'draft';

    return {
      totalMatches,
      completedMatches,
      runningMatches,
      scheduledMatches,
      totalGoals,
      nextMatch,
      progress,
      isLive,
      isCompleted,
      isDraft,
    };
  }, [tournament]);

  // Get status banner style
  const getStatusBannerStyle = () => {
    if (stats.isLive) {return styles.statusBannerLive;}
    if (stats.isCompleted) {return styles.statusBannerCompleted;}
    if (stats.isDraft) {return styles.statusBannerDraft;}
    return styles.statusBannerActive;
  };

  // Get status text
  const getStatusText = () => {
    if (stats.isLive) {return t('dashboard.statusLive');}
    if (stats.isCompleted) {return t('dashboard.statusCompleted');}
    if (stats.isDraft) {return t('dashboard.statusDraft');}
    return t('dashboard.statusActive');
  };

  // Get status color
  const getStatusColor = () => {
    if (stats.isLive) {return cssVars.colors.success;}
    if (stats.isCompleted) {return cssVars.colors.info;}
    if (stats.isDraft) {return cssVars.colors.textMuted;}
    return cssVars.colors.primary;
  };

  return (
    <CategoryPage
      icon="📊"
      title={t('dashboard.title')}
      description={t('dashboard.description')}
    >
      {/* Status Banner */}
      <div style={{ ...styles.statusBanner, ...getStatusBannerStyle() }}>
        <div style={styles.statusInfo}>
          {stats.isLive && (
            <div
              style={{
                ...styles.statusDot,
                background: cssVars.colors.success,
              }}
            />
          )}
          <div>
            <div style={{ ...styles.statusText, color: getStatusColor() }}>
              {getStatusText()}
            </div>
            <div style={styles.statusSubtext}>
              {stats.isLive
                ? t('dashboard.gamesRunning', { count: stats.runningMatches.length })
                : stats.isCompleted
                  ? t('dashboard.allGamesFinished')
                  : t('dashboard.gamesPlayed', { completed: stats.completedMatches, total: stats.totalMatches })}
            </div>
          </div>
        </div>
      </div>

      {/* Pulse animation for live status */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t('dashboard.progress')}</div>
          <div style={styles.statValue}>{Math.round(stats.progress)}%</div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${stats.progress}%`,
              }}
            />
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t('dashboard.matches')}</div>
          <div style={styles.statValue}>
            {stats.completedMatches}/{stats.totalMatches}
          </div>
          <div style={styles.statSubvalue}>
            {t('dashboard.matchesPending', { count: stats.scheduledMatches.length })}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t('dashboard.teams')}</div>
          <div style={styles.statValue}>{tournament.teams.length}</div>
          <div style={styles.statSubvalue}>
            {t('dashboard.groups', { count: tournament.numberOfGroups ?? 1 })}
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>{t('dashboard.goals')}</div>
          <div style={styles.statValue}>{stats.totalGoals}</div>
          <div style={styles.statSubvalue}>
            {t('dashboard.goalsPerMatch', { avg: stats.completedMatches > 0 ? (stats.totalGoals / stats.completedMatches).toFixed(1) : '0' })}
          </div>
        </div>
      </div>

      {/* Running Matches */}
      {stats.runningMatches.length > 0 && (
        <CollapsibleSection icon="🏃" title={t('dashboard.runningMatches', { count: stats.runningMatches.length })} defaultOpen>
          <div style={styles.runningMatchesList}>
            {stats.runningMatches.map((match: Match) => (
              <div key={match.id} style={styles.runningMatchItem}>
                <div>
                  <div style={styles.runningMatchTeams}>
                    {getTeamName(tournament, match.teamA, t('dashboard.unknownTeam'))} vs {getTeamName(tournament, match.teamB, t('dashboard.unknownTeam'))}
                  </div>
                  <div style={styles.runningMatchField}>
                    {getFieldName(tournament, match.field)}
                  </div>
                </div>
                <div style={styles.runningMatchScore}>
                  {match.scoreA ?? 0} : {match.scoreB ?? 0}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Next Match */}
      {stats.nextMatch && (
        <CollapsibleSection icon="⏭️" title={t('dashboard.nextMatch')} defaultOpen>
          <div style={styles.nextMatchCard}>
            <div style={styles.nextMatchHeader}>
              <span style={styles.nextMatchLabel}>{t('dashboard.upcoming')}</span>
              {stats.nextMatch.scheduledTime && (
                <span style={styles.nextMatchTime}>
                  {formatTime(stats.nextMatch.scheduledTime)}
                </span>
              )}
            </div>
            <div style={styles.nextMatchTeams}>
              <span>{getTeamName(tournament, stats.nextMatch.teamA, t('dashboard.unknownTeam'))}</span>
              <span style={styles.nextMatchVs}>vs</span>
              <span>{getTeamName(tournament, stats.nextMatch.teamB, t('dashboard.unknownTeam'))}</span>
            </div>
            <div style={styles.nextMatchField}>
              {getFieldName(tournament, stats.nextMatch.field)}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Quick Actions */}
      <CollapsibleSection icon="⚡" title={t('dashboard.quickActions')} defaultOpen>
        <div style={styles.quickActions}>
          <button
            style={styles.actionButton}
            onClick={() => { void navigate(`/tournament/${tournamentId}`); }}
          >
            <span style={styles.actionIcon}>📋</span>
            <span>{t('dashboard.openSchedule')}</span>
          </button>
          <button
            style={styles.actionButton}
            onClick={() => { void navigate(`/tournament/${tournamentId}/admin/settings`); }}
          >
            <span style={styles.actionIcon}>⏸️</span>
            <span>{t('dashboard.pauseSettings')}</span>
          </button>
          <button
            style={styles.actionButton}
            onClick={() => { void navigate(`/tournament/${tournamentId}/admin/visibility`); }}
          >
            <span style={styles.actionIcon}>👁️</span>
            <span>{t('dashboard.visibility')}</span>
          </button>
          <button
            style={styles.actionButton}
            onClick={() => { void navigate(`/tournament/${tournamentId}/admin/exports`); }}
          >
            <span style={styles.actionIcon}>📥</span>
            <span>{t('dashboard.export')}</span>
          </button>
          <button
            style={styles.actionButton}
            onClick={() => { void navigate(`/tournament/${tournamentId}/admin/activity-log`); }}
          >
            <span style={styles.actionIcon}>📋</span>
            <span>{t('dashboard.activityLog')}</span>
          </button>
        </div>
      </CollapsibleSection>

      {/* Tournament Info */}
      <CollapsibleSection icon="ℹ️" title={t('dashboard.tournamentInfo')}>
        <div style={{ display: 'grid', gap: cssVars.spacing.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cssVars.colors.textSecondary }}>{t('dashboard.infoDate')}</span>
            <span>{tournament.startDate ?? tournament.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cssVars.colors.textSecondary }}>{t('dashboard.infoStartTime')}</span>
            {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty time should use fallback */}
            <span>{tournament.startTime || tournament.timeSlot || '-'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cssVars.colors.textSecondary }}>{t('dashboard.infoLocation')}</span>
            <span>{tournament.location.name || '-'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cssVars.colors.textSecondary }}>{t('dashboard.infoFields')}</span>
            <span>{tournament.numberOfFields}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: cssVars.colors.textSecondary }}>{t('dashboard.infoMode')}</span>
            <span>
              {tournament.groupSystem === 'roundRobin'
                ? t('dashboard.modeRoundRobin')
                : t('dashboard.modeGroupsFinals')}
            </span>
          </div>
        </div>
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default DashboardCategory;
