/**
 * MatchCardScore - Score circle with Progress Ring
 *
 * Displays match score in a circular container:
 * - Scheduled: "VS" text
 * - Running: Progress-Ring + Score + Timer
 * - Finished: Score only
 *
 * @example
 * ```tsx
 * <MatchCardScore
 *   homeScore={2}
 *   awayScore={1}
 *   status="running"
 *   progress={0.75}
 *   elapsedFormatted="07:30"
 *   onClick={() => handleCircleClick()}
 * />
 * ```
 */

import { type CSSProperties, useState } from 'react';
import { cssVars } from '../../../design-tokens'
import { ProgressRing } from '../../ui/ProgressRing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchCardStatus = 'scheduled' | 'waiting' | 'running' | 'finished' | 'skipped';

export interface MatchCardScoreProps {
  /** Home team score */
  homeScore: number;
  /** Away team score */
  awayScore: number;
  /** Current match status */
  status: MatchCardStatus;
  /** Progress value 0-1 (for running matches) */
  progress?: number;
  /** Formatted elapsed time (e.g., "07:30") */
  elapsedFormatted?: string;
  /** Circle size in pixels (default: 56) */
  size?: number;
  /** Click handler */
  onClick?: () => void;
  /** Disable interaction */
  disabled?: boolean;
  /** Match ID for testing */
  matchId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCardScore: React.FC<MatchCardScoreProps> = ({
  homeScore,
  awayScore,
  status,
  progress = 0,
  elapsedFormatted,
  size = 56,
  onClick,
  disabled = false,
  matchId,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isLive = status === 'running';
  const isScheduled = status === 'scheduled' || status === 'waiting';
  const isFinished = status === 'finished';

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'transform 0.15s ease',
    transform: isHovered && !disabled ? 'scale(1.05)' : 'scale(1)',
  };

  const circleStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cssVars.colors.surfaceDark,
    border: `2px solid ${isLive ? cssVars.colors.primary : isHovered ? cssVars.colors.primary : cssVars.colors.border}`,
    transition: 'border-color 0.15s ease',
  };

  const vsStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
  };

  const scoreStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    fontWeight: 900,
    color: cssVars.colors.textPrimary,
    lineHeight: 1,
  };

  const timerStyle: CSSProperties = {
    fontSize: '9px',
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.primary,
    lineHeight: 1,
    marginTop: '2px',
    fontVariantNumeric: 'tabular-nums',
  };

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent card click handler from interfering
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Live match: Progress Ring
  if (isLive) {
    return (
      <div
        style={containerStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty elapsedFormatted should show 'Live'
        aria-label={`Spielstand ${homeScore}:${awayScore}, ${elapsedFormatted || 'Live'}`}
        data-testid={matchId ? `match-circle-${matchId}` : 'match-circle'}
        data-match-status="running"
      >
        <ProgressRing
          progress={progress}
          size={size}
          strokeWidth={3}
          color={cssVars.colors.primary}
          backgroundColor={cssVars.colors.border}
          animated={true}
        >
          <span style={scoreStyle}>
            {homeScore}:{awayScore}
          </span>
          {elapsedFormatted && (
            <span style={timerStyle}>{elapsedFormatted}</span>
          )}
        </ProgressRing>
      </div>
    );
  }

  // Scheduled match: "VS"
  if (isScheduled) {
    return (
      <div
        style={containerStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        aria-label="Spiel starten"
        data-testid={matchId ? `match-circle-${matchId}` : 'match-circle'}
        data-match-status="scheduled"
      >
        <div style={circleStyle}>
          <span style={vsStyle}>VS</span>
        </div>
      </div>
    );
  }

  // Finished match: Score only
  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-label={`Endstand ${homeScore}:${awayScore}`}
      data-testid={matchId ? `match-circle-${matchId}` : 'match-circle'}
      data-match-status="finished"
    >
      <div style={circleStyle}>
        <span style={scoreStyle}>
          {homeScore}:{awayScore}
        </span>
        {isFinished && (
          <span style={{ ...timerStyle, color: cssVars.colors.textSecondary }}>
            Ende
          </span>
        )}
      </div>
    </div>
  );
};

export default MatchCardScore;
