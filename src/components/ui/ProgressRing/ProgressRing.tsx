/**
 * ProgressRing - Animated SVG progress ring
 *
 * Used for displaying live match progress in the schedule view.
 * Shows a circular progress indicator that fills based on elapsed time.
 *
 * @example
 * ```tsx
 * <ProgressRing progress={0.75} size={60} />
 * ```
 */

import { type CSSProperties } from 'react';
import { colors, fontSizes, fontWeights } from '../../../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressRingProps {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Ring diameter in pixels (default: 60) */
  size?: number;
  /** Ring stroke width in pixels (default: 3) */
  strokeWidth?: number;
  /** Progress ring color (default: colors.primary) */
  color?: string;
  /** Background ring color (default: colors.border) */
  backgroundColor?: string;
  /** Enable pulse animation for live state (default: true) */
  animated?: boolean;
  /** Content to display in center (typically score) */
  children?: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pulseKeyframes = `
@keyframes progressRingPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 60,
  strokeWidth = 3,
  color = colors.primary,
  backgroundColor = colors.border,
  animated = true,
  children,
  className,
  onClick,
  ariaLabel,
}) => {
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Calculate SVG values
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clampedProgress);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    cursor: onClick ? 'pointer' : 'default',
  };

  const svgStyle: CSSProperties = {
    transform: 'rotate(-90deg)',
    animation: animated ? 'progressRingPulse 2s ease-in-out infinite' : 'none',
  };

  const centerContentStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div
        style={containerStyle}
        className={className}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        } : undefined}
        aria-label={ariaLabel}
        aria-valuenow={Math.round(clampedProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={svgStyle}
          aria-hidden="true"
        >
          {/* Background Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.3s ease-out',
            }}
          />
        </svg>

        {/* Center Content */}
        <div style={centerContentStyle}>
          {children}
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: Score Content
// ---------------------------------------------------------------------------

export interface ScoreContentProps {
  homeScore: number;
  awayScore: number;
  timer?: string;
  isLive?: boolean;
}

export const ScoreContent: React.FC<ScoreContentProps> = ({
  homeScore,
  awayScore,
  timer,
  isLive = false,
}) => {
  const scoreStyle: CSSProperties = {
    fontSize: fontSizes.md,
    fontWeight: 900, // Extra bold for score display
    color: colors.textPrimary,
    lineHeight: 1,
  };

  const timerStyle: CSSProperties = {
    fontSize: '9px',
    fontWeight: fontWeights.semibold,
    color: isLive ? colors.primary : colors.textSecondary,
    lineHeight: 1,
    marginTop: '2px',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <>
      <span style={scoreStyle}>
        {homeScore}:{awayScore}
      </span>
      {timer && <span style={timerStyle}>{timer}</span>}
    </>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: VS Content (for not started matches)
// ---------------------------------------------------------------------------

export const VSContent: React.FC = () => {
  const vsStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textSecondary,
    lineHeight: 1,
  };

  return <span style={vsStyle}>VS</span>;
};

export default ProgressRing;
