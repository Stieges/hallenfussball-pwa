/**
 * MatchCockpit - Admin Cockpit für Live-Spielverwaltung
 *
 * WICHTIG: Reine Präsentationskomponente!
 * - Alle Daten kommen über Props
 * - Keine API-Calls, kein fetch, kein axios
 * - Nur Callbacks nach oben
 * - Keine Geschäftslogik (außer Formatierung)
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { useIsMobile } from '../../hooks/useIsMobile';
import { CurrentMatchPanel } from './CurrentMatchPanel';
import { UpcomingMatchesSidebar } from './UpcomingMatchesSidebar';
import type { MatchStatus, Team, MatchEvent, MatchPlayPhase, LiveMatch, MatchSummary } from '../live-cockpit/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type { MatchStatus, Team, MatchEvent, MatchPlayPhase, LiveMatch, MatchSummary };

export interface MatchCockpitProps {
  fieldName: string;
  tournamentName: string;

  currentMatch: LiveMatch | null;
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  upcomingMatches: MatchSummary[];
  highlightNextMatchMinutesBefore?: number;

  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onAdjustTime(matchId: string, newElapsedSeconds: number): void;

  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;

  // Tiebreaker callbacks
  onStartOvertime?(matchId: string): void;
  onStartGoldenGoal?(matchId: string): void;
  onStartPenaltyShootout?(matchId: string): void;
  onRecordPenaltyResult?(matchId: string, homeScore: number, awayScore: number): void;
  onForceFinish?(matchId: string): void;
  onCancelTiebreaker?(matchId: string): void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MatchCockpit: React.FC<MatchCockpitProps> = ({
  fieldName,
  tournamentName,
  currentMatch,
  lastFinishedMatch,
  upcomingMatches,
  highlightNextMatchMinutesBefore = 5,
  onStart,
  onPause,
  onResume,
  onFinish,
  onGoal,
  onUndoLastEvent,
  onManualEditResult,
  onAdjustTime,
  onLoadNextMatch,
  onReopenLastMatch,
  // Tiebreaker callbacks
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onRecordPenaltyResult,
  onForceFinish,
  onCancelTiebreaker,
}) => {
  const { t } = useTranslation('cockpit');
  const isMobile = useIsMobile();

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '1080px',
    margin: '0 auto',
    padding: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? cssVars.spacing.md : `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: 'rgba(15, 23, 42, 0.96)',
    borderRadius: isMobile ? cssVars.borderRadius.lg : '999px',
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: cssVars.shadows.lg,
    backdropFilter: 'blur(18px)',
  };

  const headerLeftStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: isMobile ? '1 1 100%' : '0 1 auto',
  };

  const tournamentNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: cssVars.colors.textSecondary,
  };

  const fieldNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  };

  const mainLayoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2.1fr) minmax(0, 1.4fr)',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };

  const nextMatch = upcomingMatches[0];

  // Calculate remaining time in current match (for "prepare next match" warning)
  const remainingMinutes = currentMatch?.status === 'RUNNING'
    ? Math.max(0, Math.floor((currentMatch.durationSeconds - currentMatch.elapsedSeconds) / 60))
    : null;

  // Check if there's a phase change between current and next match
  // (e.g., group stage → finals = don't show warning, teams have a longer break)
  const isPhaseChange = currentMatch?.tournamentPhase && nextMatch.tournamentPhase
    ? currentMatch.tournamentPhase !== nextMatch.tournamentPhase
    : false;

  // Show warning if:
  // 1. Match is running AND remaining time <= threshold
  // 2. AND no phase change (group → finals has a longer break)
  const showRemainingTimeWarning =
    remainingMinutes !== null &&
    remainingMinutes <= highlightNextMatchMinutesBefore &&
     
    nextMatch &&
    !isPhaseChange;

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <header style={headerStyle}>
        <div style={headerLeftStyle}>
          <div style={tournamentNameStyle}>{tournamentName}</div>
          <div style={fieldNameStyle}>{fieldName} – {t('matchCockpit.title')}</div>
        </div>
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusChip
            status={currentMatch?.status ?? 'NOT_STARTED'}
            phaseLabel={currentMatch?.phaseLabel ?? ''}
          />
          {/* Show warning based on remaining time in current match (not scheduled time) */}
          {showRemainingTimeWarning && (
            <WarningChip message={t('matchCockpit.prepareWarning', { minutes: remainingMinutes })} />
          )}
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main style={mainLayoutStyle}>
        {/* CURRENT MATCH PANEL */}
        <CurrentMatchPanel
          currentMatch={currentMatch}
          lastFinishedMatch={lastFinishedMatch}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onFinish={onFinish}
          onGoal={onGoal}
          onUndoLastEvent={onUndoLastEvent}
          onManualEditResult={onManualEditResult}
          onAdjustTime={onAdjustTime}
          onLoadNextMatch={onLoadNextMatch}
          onReopenLastMatch={onReopenLastMatch}
          // Tiebreaker callbacks
          onStartOvertime={onStartOvertime}
          onStartGoldenGoal={onStartGoldenGoal}
          onStartPenaltyShootout={onStartPenaltyShootout}
          onRecordPenaltyResult={onRecordPenaltyResult}
          onForceFinish={onForceFinish}
          onCancelTiebreaker={onCancelTiebreaker}
        />

        {/* UPCOMING MATCHES SIDEBAR */}
        <UpcomingMatchesSidebar
          upcomingMatches={upcomingMatches}
          highlightMinutesBefore={highlightNextMatchMinutesBefore}
          fieldName={fieldName}
          highlightFirstMatch={showRemainingTimeWarning}
        />
      </main>
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusChipProps {
  status: MatchStatus;
  phaseLabel: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, phaseLabel }) => {
  const { t } = useTranslation('cockpit');
  const isMobile = useIsMobile();

  const chipStyle: CSSProperties = {
    padding: isMobile ? `8px ${cssVars.spacing.md}` : `6px ${cssVars.spacing.md}`,
    borderRadius: '999px',
    border: `1px solid ${cssVars.colors.border}`,
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(15, 23, 42, 0.85)',
  };

  const dotStyle: CSSProperties = {
    width: isMobile ? '6px' : '8px',
    height: isMobile ? '6px' : '8px',
    borderRadius: '999px',
    background: cssVars.colors.primary,
    boxShadow: `0 0 8px ${cssVars.colors.primary}`,
  };

  const getStatusText = () => {
    switch (status) {
      case 'RUNNING':
        return t('matchCockpit.running');
      case 'PAUSED':
        return t('matchCockpit.paused');
      case 'FINISHED':
        return t('matchCockpit.finished');
      default:
        return t('matchCockpit.ready');
    }
  };

  return (
    <div style={chipStyle}>
      <div style={dotStyle} />
      <span>
        {getStatusText()} – {phaseLabel}
      </span>
    </div>
  );
};

interface WarningChipProps {
  message: string;
}

const WarningChip: React.FC<WarningChipProps> = ({ message }) => {
  const isMobile = useIsMobile();

  const chipStyle: CSSProperties = {
    padding: isMobile ? `8px ${cssVars.spacing.md}` : `6px ${cssVars.spacing.md}`,
    borderRadius: '999px',
    border: `1px solid ${cssVars.colors.warning}`,
    fontSize: isMobile ? cssVars.fontSizes.xs : cssVars.fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: `rgba(255, 145, 0, 0.1)`,
    color: cssVars.colors.warning,
  };

  return <div style={chipStyle}>{message}</div>;
};

// Note: calculateMinutesUntil is now imported from utils/timeHelpers.ts
