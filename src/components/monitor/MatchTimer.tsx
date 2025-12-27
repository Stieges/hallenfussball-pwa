/**
 * MatchTimer - Real-time timer display for monitor view
 *
 * Features:
 * - MM:SS / MM:SS format (elapsed / total)
 * - Progress bar with percentage
 * - Warning state when < 2 min remaining (red pulse)
 * - Pause indicator (yellow pulse)
 * - Overtime indication (red text)
 */

import { CSSProperties, useState, useEffect } from 'react';
import { borderRadius, colors, fontFamilies, fontWeights } from '../../design-tokens';
import { MatchStatus } from '../../hooks/useLiveMatches';

export interface MatchTimerProps {
  /** Current elapsed seconds */
  elapsedSeconds: number;
  /** Total match duration in seconds */
  durationSeconds: number;
  /** Match status */
  status: MatchStatus;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Show progress bar */
  showProgress?: boolean;
  /** Warning threshold in seconds (default: 120 = 2 min) */
  warningThresholdSeconds?: number;
  /** Timer start time for real-time calculation */
  timerStartTime?: string;
  /** Timer elapsed seconds before current run */
  timerElapsedSeconds?: number;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate real-time elapsed seconds
 */
function calculateRealTimeElapsed(
  status: MatchStatus,
  timerStartTime?: string,
  timerElapsedSeconds?: number,
  fallbackElapsed?: number
): number {
  if (status === 'NOT_STARTED') {
    return 0;
  }

  if (status === 'PAUSED' || status === 'FINISHED' || !timerStartTime) {
    return timerElapsedSeconds ?? fallbackElapsed ?? 0;
  }

  // RUNNING: Calculate from timestamp
  const startTime = new Date(timerStartTime).getTime();
  const now = Date.now();
  const runtimeSeconds = Math.floor((now - startTime) / 1000);
  return (timerElapsedSeconds ?? 0) + runtimeSeconds;
}

export const MatchTimer: React.FC<MatchTimerProps> = ({
  elapsedSeconds: propElapsedSeconds,
  durationSeconds,
  status,
  size = 'lg',
  showProgress = true,
  warningThresholdSeconds = 120,
  timerStartTime,
  timerElapsedSeconds,
}) => {
  // Real-time elapsed seconds (updates every second when running)
  const [displayElapsed, setDisplayElapsed] = useState(() =>
    calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds)
  );

  // Update every second when running
  useEffect(() => {
    if (status !== 'RUNNING') {
      setDisplayElapsed(calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds));
      return;
    }

    const updateTimer = () => {
      setDisplayElapsed(calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [status, timerStartTime, timerElapsedSeconds, propElapsedSeconds]);

  const remainingSeconds = durationSeconds - displayElapsed;
  const isOvertime = displayElapsed > durationSeconds;
  const isNearEnd = !isOvertime && remainingSeconds <= warningThresholdSeconds && remainingSeconds > 0;
  const isPaused = status === 'PAUSED';
  const progressPercent = Math.min(100, (displayElapsed / durationSeconds) * 100);

  // Size-based styling - optimized for TV viewing
  const sizeStyles: Record<string, { time: string; progress: string; gap: string }> = {
    sm: { time: '18px', progress: '6px', gap: '6px' },
    md: { time: '28px', progress: '8px', gap: '10px' },
    lg: { time: '42px', progress: '12px', gap: '14px' },
    xl: { time: 'clamp(48px, 5vw, 72px)', progress: '16px', gap: '20px' },
  };

  const currentSize = sizeStyles[size];

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: currentSize.gap,
    width: '100%',
  };

  const timeContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: size === 'xl' ? '12px' : '8px',
  };

  const timeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: fontWeights.bold,
    fontFamily: fontFamilies.heading,
    color: isOvertime
      ? colors.error
      : isPaused
        ? colors.warning
        : colors.textPrimary,
    textShadow: isOvertime || isPaused
      ? `0 0 20px ${isOvertime ? colors.error : colors.warning}`
      : '0 2px 8px rgba(0, 0, 0, 0.4)',
    animation: isPaused ? 'timerPause 1.5s ease-in-out infinite' : undefined,
    letterSpacing: '0.02em',
  };

  const separatorStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: fontWeights.bold,
    color: 'rgba(255, 255, 255, 0.6)',
  };

  const totalTimeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: fontWeights.medium,
    color: 'rgba(255, 255, 255, 0.5)',
  };

  const progressContainerStyle: CSSProperties = {
    width: '100%',
    height: currentSize.progress,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: currentSize.progress,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  };

  const progressBarStyle: CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    background: isOvertime
      ? `linear-gradient(90deg, ${colors.error} 0%, ${colors.gradientErrorLight} 100%)`
      : isNearEnd
        ? `linear-gradient(90deg, ${colors.error} 0%, ${colors.gradientErrorLight} 100%)`
        : `linear-gradient(90deg, ${colors.primary} 0%, ${colors.gradientPrimaryLight} 100%)`,
    borderRadius: currentSize.progress,
    transition: 'width 0.5s linear',
    boxShadow: isNearEnd || isOvertime
      ? `0 0 12px ${colors.error}`
      : `0 0 10px ${colors.primary}`,
    animation: isNearEnd ? 'progressPulse 1s ease-in-out infinite' : undefined,
  };

  const statusBadgeStyle: CSSProperties = {
    padding: size === 'xl' ? '8px 20px' : '6px 14px',
    borderRadius: borderRadius.md,
    fontSize: size === 'xl' ? '18px' : size === 'lg' ? '14px' : '12px',
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    backgroundColor: isPaused
      ? 'rgba(255,145,0,0.25)'
      : 'rgba(0,230,118,0.25)',
    color: isPaused
      ? colors.warning
      : colors.primary,
    boxShadow: isPaused
      ? `0 0 15px rgba(255,145,0,0.3)`
      : `0 0 15px rgba(0,230,118,0.3)`,
    animation: isPaused ? 'statusPulse 1.5s ease-in-out infinite' : undefined,
  };

  return (
    <>
      <div style={containerStyle}>
        <div style={timeContainerStyle}>
          <span style={timeStyle}>{formatTime(displayElapsed)}</span>
          <span style={separatorStyle}>/</span>
          <span style={totalTimeStyle}>{formatTime(durationSeconds)}</span>
        </div>

        {showProgress && (
          <div style={progressContainerStyle}>
            <div style={progressBarStyle} />
          </div>
        )}

        {isPaused && (
          <div style={statusBadgeStyle}>Pause</div>
        )}

        {isOvertime && !isPaused && (
          <div style={{ ...statusBadgeStyle, backgroundColor: 'rgba(255,82,82,0.2)', color: colors.error }}>
            Nachspielzeit
          </div>
        )}
      </div>

      <style>{`
        @keyframes timerPause {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  );
};
