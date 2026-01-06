/**
 * MatchTimer - Real-time timer display for monitor view
 *
 * Features:
 * - MM:SS / MM:SS format (elapsed / total)
 * - Progress bar with percentage
 * - Warning state when < 2 min remaining (red pulse)
 * - Pause indicator (yellow pulse)
 * - Overtime indication (red text)
 * - Theme support (dark/light/auto)
 */

import { CSSProperties, useState, useEffect } from 'react';
import { cssVars } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';

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
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
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
  theme = 'dark',
}) => {
  // Resolve auto theme based on system preference
  const { themeColors } = useMonitorTheme(theme);

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
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.heading,
    color: isOvertime
      ? themeColors.timerOvertime
      : isPaused
        ? themeColors.timerPaused
        : themeColors.timerNormal,
    textShadow: isOvertime || isPaused
      ? `0 0 20px ${isOvertime ? themeColors.timerOvertime : themeColors.timerPaused}`
      : themeColors.textShadowLight,
    animation: isPaused ? 'timerPause 1.5s ease-in-out infinite' : undefined,
    letterSpacing: '0.02em',
  };

  const separatorStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: cssVars.fontWeights.bold,
    color: themeColors.timerSeparator,
  };

  const totalTimeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: cssVars.fontWeights.medium,
    color: themeColors.timerSecondary,
  };

  const progressContainerStyle: CSSProperties = {
    width: '100%',
    height: currentSize.progress,
    backgroundColor: themeColors.progressTrack,
    borderRadius: currentSize.progress,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: themeColors.progressInsetShadow,
  };

  const progressBarStyle: CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    background: isOvertime || isNearEnd
      ? `linear-gradient(90deg, ${themeColors.progressBarWarning} 0%, ${themeColors.timerWarning} 100%)`
      : `linear-gradient(90deg, ${themeColors.progressBar} 0%, ${themeColors.liveBadgeText} 100%)`,
    borderRadius: currentSize.progress,
    transition: 'width 1s linear',
    boxShadow: isNearEnd || isOvertime
      ? themeColors.progressShadowWarning
      : themeColors.progressShadow,
    animation: isNearEnd ? 'progressPulse 1s ease-in-out infinite' : undefined,
  };

  const statusBadgeStyle: CSSProperties = {
    padding: size === 'xl' ? '8px 20px' : '6px 14px',
    borderRadius: cssVars.borderRadius.md,
    fontSize: size === 'xl' ? '18px' : size === 'lg' ? '14px' : '12px',
    fontWeight: cssVars.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    backgroundColor: isPaused
      ? themeColors.pauseBadgeBg
      : themeColors.liveBadgeBg,
    color: isPaused
      ? themeColors.pauseBadgeText
      : themeColors.liveBadgeText,
    boxShadow: isPaused
      ? themeColors.progressShadowWarning
      : themeColors.progressShadow,
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
          <div style={{ ...statusBadgeStyle, backgroundColor: themeColors.overtimeBadgeBg, color: themeColors.timerOvertime }}>
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
