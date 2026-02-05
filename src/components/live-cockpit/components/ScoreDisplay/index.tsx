/**
 * ScoreDisplay - Central Score and Timer Display (Redesigned)
 *
 * Classic scoreboard layout:
 * ┌─────────────────────────────────────────────────┐
 * │              ⏱ 05:23 / 10:00                    │
 * ├─────────────────────────────────────────────────┤
 * │  TEAM A          3 : 2          TEAM B          │
 * │  (Heim)                         (Gast)          │
 * └─────────────────────────────────────────────────┘
 *
 * Key improvements:
 * - Team names are LARGE and prominent
 * - Three-column layout: Team | Score | Team
 * - Home/Away labels for clarity
 * - Timer at top (secondary importance)
 */

import { useState, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
import type { Breakpoint } from '../../../../hooks';
import type { Team, MatchStatus, MatchPlayPhase } from '../../types';
import styles from '../../LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreDisplayProps {
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  elapsedSeconds: number;
  durationSeconds: number;
  status: MatchStatus;
  playPhase?: MatchPlayPhase;
  overtimeScore?: { home: number; away: number };
  penaltyScore?: { home: number; away: number };
  onTimerClick?: () => void;
  breakpoint?: Breakpoint;
  /** Compact mode for focus view - shows only score and minimal timer */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  elapsedSeconds,
  durationSeconds,
  status,
  playPhase,
  overtimeScore,
  penaltyScore,
  onTimerClick,
  breakpoint = 'desktop',
  compact = false,
}) => {
  const { t } = useTranslation('cockpit');
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isRunning = status === 'RUNNING';

  // Track score changes for animation
  const [homeAnimating, setHomeAnimating] = useState(false);
  const [awayAnimating, setAwayAnimating] = useState(false);
  const [prevHomeScore, setPrevHomeScore] = useState(homeScore);
  const [prevAwayScore, setPrevAwayScore] = useState(awayScore);

  // Trigger animation when scores change
  useEffect(() => {
    if (homeScore !== prevHomeScore) {
      setHomeAnimating(true);
      setPrevHomeScore(homeScore);
      const timer = setTimeout(() => setHomeAnimating(false), 400);
      return () => clearTimeout(timer);
    }
  }, [homeScore, prevHomeScore]);

  useEffect(() => {
    if (awayScore !== prevAwayScore) {
      setAwayAnimating(true);
      setPrevAwayScore(awayScore);
      const timer = setTimeout(() => setAwayAnimating(false), 400);
      return () => clearTimeout(timer);
    }
  }, [awayScore, prevAwayScore]);

  // ---------------------------------------------------------------------------
  // Phase label
  // ---------------------------------------------------------------------------

  const getPhaseLabel = () => {
    if (playPhase === 'overtime') {return t('score.overtime');}
    if (playPhase === 'goldenGoal') {return t('score.goldenGoal');}
    if (playPhase === 'penalty') {return t('score.penaltyShootout');}
    return null;
  };

  const phaseLabel = getPhaseLabel();

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
    padding: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
    background: `linear-gradient(180deg, ${cssVars.colors.surfaceSolid}, ${cssVars.colors.surface})`,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px solid ${cssVars.colors.border}`,
    width: '100%',
    maxWidth: '700px',
  };

  // Timer row at top
  const timerRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: isRunning ? `${cssVars.colors.primary}15` : cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.md,
    border: isRunning ? `1px solid ${cssVars.colors.primary}40` : `1px solid ${cssVars.colors.border}`,
    cursor: onTimerClick ? 'pointer' : 'default',
  };

  const timerLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const timerValueStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    fontVariantNumeric: 'tabular-nums',
    color: isRunning ? cssVars.colors.primary : cssVars.colors.textPrimary,
  };

  // Main scoreboard - three columns
  const scoreboardStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
    width: '100%',
    padding: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
  };

  // Team column styles
  const teamColumnStyle = (side: 'home' | 'away'): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: side === 'home' ? 'flex-end' : 'flex-start',
    gap: cssVars.spacing.xs,
  });

  const teamNameStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.md : isTablet ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    textAlign: 'center',
    wordBreak: 'break-word',
    lineHeight: 1.1,
  };

  const teamLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  };

  // Center score
  const scoreCenterStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
    padding: isMobile ? cssVars.spacing.xs : cssVars.spacing.sm,
    background: cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.md,
    minWidth: isMobile ? '80px' : '120px',
  };

  const scoreValueStyle: CSSProperties = {
    fontSize: isMobile ? '2rem' : isTablet ? '2.5rem' : '3rem',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    minWidth: isMobile ? '28px' : '40px',
    textAlign: 'center',
  };

  const scoreSeparatorStyle: CSSProperties = {
    fontSize: isMobile ? '1.5rem' : '2rem',
    fontWeight: cssVars.fontWeights.normal,
    color: cssVars.colors.textSecondary,
    lineHeight: 1,
  };

  // Phase indicator
  const phaseIndicatorStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.warning,
    background: cssVars.colors.warningLight,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    textTransform: 'uppercase',
  };

  // ---------------------------------------------------------------------------
  // Compact Mode Styles (Focus View)
  // ---------------------------------------------------------------------------

  const compactContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    width: '100%',
  };

  const compactScoreStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };

  const compactScoreValueStyle: CSSProperties = {
    fontSize: isMobile ? '3.5rem' : isTablet ? '4rem' : '4.5rem',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  };

  const compactSeparatorStyle: CSSProperties = {
    fontSize: isMobile ? '2rem' : '3rem',
    fontWeight: cssVars.fontWeights.normal,
    color: cssVars.colors.textSecondary,
    lineHeight: 1,
  };

  const compactTimerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    fontSize: isMobile ? cssVars.fontSizes.lg : cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    fontVariantNumeric: 'tabular-nums',
    color: isRunning ? cssVars.colors.primary : cssVars.colors.textSecondary,
  };

  // ---------------------------------------------------------------------------
  // Render - Compact Mode (Focus View)
  // ---------------------------------------------------------------------------

  if (compact) {
    return (
      <div style={compactContainerStyle}>
        {/* Giant Score - 96px (Konzept §4.1) */}
        <div style={compactScoreStyle}>
          <span
            style={compactScoreValueStyle}
            className={`${styles.scoreValue} ${homeAnimating ? styles.animate : ''}`}
            role="text"
            aria-label={`${homeTeam.name} ${homeScore}`}
          >
            {homeScore}
          </span>
          <span style={compactSeparatorStyle} aria-hidden="true">:</span>
          <span
            style={compactScoreValueStyle}
            className={`${styles.scoreValue} ${awayAnimating ? styles.animate : ''}`}
            role="text"
            aria-label={`${awayTeam.name} ${awayScore}`}
          >
            {awayScore}
          </span>
        </div>

        {/* Timer below score */}
        <div style={compactTimerStyle}>
          {isRunning && <span style={{ color: cssVars.colors.error }}>●</span>}
          <span aria-live="polite">{formatTime(elapsedSeconds)}</span>
          {status !== 'FINISHED' && (
            <span style={{ color: cssVars.colors.textSecondary }}>/ {formatTime(durationSeconds)}</span>
          )}
        </div>

        {/* Phase indicator if special */}
        {phaseLabel && (
          <span style={phaseIndicatorStyle}>{phaseLabel}</span>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render - Full Mode (Standard/Extended View)
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Timer row at top */}
      <div
        style={timerRowStyle}
        className={onTimerClick ? styles.timerClickable : undefined}
        onClick={onTimerClick}
        role={onTimerClick ? 'button' : undefined}
        tabIndex={onTimerClick ? 0 : undefined}
        onKeyDown={onTimerClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTimerClick(); } } : undefined}
        aria-label={onTimerClick ? t('score.editTimeAria') : undefined}
      >
        {isRunning && <span style={{ color: cssVars.colors.error }}>●</span>}
        <span style={timerLabelStyle}>
          {status === 'NOT_STARTED' ? t('score.matchTime') : status === 'FINISHED' ? t('score.finalScore') : t('score.live')}
        </span>
        <span style={timerValueStyle} aria-live="polite">
          {formatTime(elapsedSeconds)}
        </span>
        {status !== 'FINISHED' && (
          <span style={timerLabelStyle}>/ {formatTime(durationSeconds)}</span>
        )}
      </div>

      {/* Phase indicator (if special phase) */}
      {phaseLabel && (
        <span style={phaseIndicatorStyle}>{phaseLabel}</span>
      )}

      {/* Main scoreboard: Team Name | Score | Team Name */}
      <div style={scoreboardStyle}>
        {/* Home Team */}
        <div style={teamColumnStyle('home')}>
          <span style={teamNameStyle}>{homeTeam.name}</span>
          <span style={teamLabelStyle}>{t('score.home')}</span>
        </div>

        {/* Score */}
        <div style={scoreCenterStyle}>
          <span
            style={scoreValueStyle}
            className={`${styles.scoreValue} ${homeAnimating ? styles.animate : ''}`}
            role="text"
            aria-label={`${homeTeam.name} ${homeScore}`}
          >
            {homeScore}
          </span>
          <span style={scoreSeparatorStyle} aria-hidden="true">:</span>
          <span
            style={scoreValueStyle}
            className={`${styles.scoreValue} ${awayAnimating ? styles.animate : ''}`}
            role="text"
            aria-label={`${awayTeam.name} ${awayScore}`}
          >
            {awayScore}
          </span>
        </div>

        {/* Away Team */}
        <div style={teamColumnStyle('away')}>
          <span style={teamNameStyle}>{awayTeam.name}</span>
          <span style={teamLabelStyle}>{t('score.away')}</span>
        </div>
      </div>

      {/* Additional scores for overtime/penalty */}
      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: show section if either score exists */}
      {(overtimeScore || penaltyScore) && (
        <div style={{ display: 'flex', gap: cssVars.spacing.md, flexWrap: 'wrap', justifyContent: 'center' }}>
          {overtimeScore && (
            <AdditionalScore
              label={t('score.overtime')}
              homeScore={overtimeScore.home}
              awayScore={overtimeScore.away}
            />
          )}
          {penaltyScore && (
            <AdditionalScore
              label={t('score.penaltyShootout')}
              homeScore={penaltyScore.home}
              awayScore={penaltyScore.away}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

interface AdditionalScoreProps {
  label: string;
  homeScore: number;
  awayScore: number;
}

const AdditionalScore: React.FC<AdditionalScoreProps> = ({
  label,
  homeScore,
  awayScore,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    background: cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.md,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const scoreStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{label}:</span>
      <span style={scoreStyle}>{homeScore} : {awayScore}</span>
    </div>
  );
};

export default ScoreDisplay;
