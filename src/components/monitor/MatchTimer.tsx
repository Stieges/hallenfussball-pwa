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

import { CSSProperties, useState, useEffect, useRef } from 'react';
import { cssVars } from '../../design-tokens';
import { criticalPhaseColors, criticalPhaseThresholds, getCriticalPhase } from '../../design-tokens/display';
import type { CriticalPhase } from '../../design-tokens/display';
import type { MonitorTheme } from '../../types/monitor';
import { MatchStatus } from '../../hooks/useLiveMatches';
import { useMonitorTheme } from '../../hooks';

export type { CriticalPhase } from '../../design-tokens/display';

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
  /** Called when the critical phase changes (for pulse border on parent) */
  onCriticalPhaseChange?: (phase: CriticalPhase) => void;
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
 * Format remaining seconds for countdown phase (SS:mm)
 */
function formatCountdown(remainingSeconds: number): string {
  const secs = Math.floor(remainingSeconds);
  const hundredths = Math.floor((remainingSeconds - secs) * 100);
  return `${secs.toString().padStart(2, '0')}:${hundredths.toString().padStart(2, '0')}`;
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
  onCriticalPhaseChange,
}) => {
  // Resolve auto theme based on system preference
  const { themeColors } = useMonitorTheme(theme);

  // Real-time elapsed seconds (updates every second when running)
  const [displayElapsed, setDisplayElapsed] = useState(() =>
    calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds)
  );

  // High-precision remaining for countdown phase (sub-second)
  const [preciseRemaining, setPreciseRemaining] = useState<number | null>(null);

  // Track last notified phase to avoid redundant callbacks
  const lastPhaseRef = useRef<CriticalPhase>('normal');

  // Update timer — switches to high-frequency (100ms) during countdown phase
  useEffect(() => {
    if (status !== 'RUNNING') {
      setDisplayElapsed(calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds));
      setPreciseRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds);
      setDisplayElapsed(elapsed);

      const remaining = durationSeconds - elapsed;
      const phase = getCriticalPhase(remaining, elapsed > durationSeconds);

      // High-precision for countdown: calculate sub-second remaining
      if (phase === 'countdown' && timerStartTime) {
        const startMs = new Date(timerStartTime).getTime();
        const nowMs = Date.now();
        const runtimeSec = (nowMs - startMs) / 1000;
        const preciseElapsed = (timerElapsedSeconds ?? 0) + runtimeSec;
        setPreciseRemaining(Math.max(0, durationSeconds - preciseElapsed));
      } else {
        setPreciseRemaining(null);
      }
    };

    updateTimer();

    // Determine interval: 100ms for countdown, 1000ms otherwise
    const currentElapsed = calculateRealTimeElapsed(status, timerStartTime, timerElapsedSeconds, propElapsedSeconds);
    const currentRemaining = durationSeconds - currentElapsed;
    const isCountdown = currentRemaining > 0 && currentRemaining <= criticalPhaseThresholds.countdown && currentElapsed <= durationSeconds;
    const intervalMs = isCountdown ? 100 : 1000;

    const interval = setInterval(updateTimer, intervalMs);

    return () => clearInterval(interval);
  }, [status, timerStartTime, timerElapsedSeconds, propElapsedSeconds, durationSeconds]);

  const remainingSeconds = durationSeconds - displayElapsed;
  const isOvertime = displayElapsed > durationSeconds;
  const isNearEnd = !isOvertime && remainingSeconds <= warningThresholdSeconds && remainingSeconds > 0;
  const isPaused = status === 'PAUSED';
  const progressPercent = Math.min(100, (displayElapsed / durationSeconds) * 100);

  // Critical phase escalation
  const criticalPhase = getCriticalPhase(remainingSeconds, isOvertime);

  // Notify parent of phase changes (for pulsing border)
  useEffect(() => {
    if (criticalPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = criticalPhase;
      onCriticalPhaseChange?.(criticalPhase);
    }
  }, [criticalPhase, onCriticalPhaseChange]);

  // Determine if timer should show Signal-Gelb background (critical, final, countdown)
  const isSignalPhase = criticalPhase === 'critical' || criticalPhase === 'final' || criticalPhase === 'countdown';

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
    ...(isSignalPhase && {
      backgroundColor: criticalPhaseColors.critical,
      padding: `${size === 'xl' ? '8px' : '4px'} ${size === 'xl' ? '24px' : '12px'}`,
      borderRadius: '999px',
      boxShadow: `0 0 20px ${criticalPhaseColors.pulseGlow}`,
      animation: criticalPhase === 'final' || criticalPhase === 'countdown'
        ? 'criticalPulse 0.8s ease-in-out infinite'
        : undefined,
    }),
  };

  // Timer text color based on critical phase
  const timerTextColor = (() => {
    if (isOvertime) {
      return themeColors.timerOvertime;
    }
    if (isPaused) {
      return themeColors.timerPaused;
    }
    if (isSignalPhase) {
      return criticalPhaseColors.criticalText;
    }
    if (criticalPhase === 'danger') {
      return criticalPhaseColors.danger;
    }
    if (criticalPhase === 'warning') {
      return criticalPhaseColors.warning;
    }
    return themeColors.timerNormal;
  })();

  const timeStyle: CSSProperties = {
    fontSize: currentSize.time,
    fontWeight: cssVars.fontWeights.bold,
    fontFamily: cssVars.fontFamilies.heading,
    color: timerTextColor,
    textShadow: isOvertime || isPaused
      ? `0 0 20px ${isOvertime ? themeColors.timerOvertime : themeColors.timerPaused}`
      : isSignalPhase
        ? 'none'
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

  const progressBarBackground = (() => {
    if (isSignalPhase) {
      return `linear-gradient(90deg, ${criticalPhaseColors.critical} 0%, ${criticalPhaseColors.warning} 100%)`;
    }
    if (isOvertime || isNearEnd) {
      return `linear-gradient(90deg, ${themeColors.progressBarWarning} 0%, ${themeColors.timerWarning} 100%)`;
    }
    return `linear-gradient(90deg, ${themeColors.progressBar} 0%, ${themeColors.liveBadgeText} 100%)`;
  })();

  const progressBarStyle: CSSProperties = {
    height: '100%',
    width: `${progressPercent}%`,
    background: progressBarBackground,
    borderRadius: currentSize.progress,
    transition: criticalPhase === 'countdown' ? 'width 0.1s linear' : 'width 1s linear',
    boxShadow: isSignalPhase
      ? `0 0 12px ${criticalPhaseColors.pulseGlow}`
      : isNearEnd || isOvertime
        ? themeColors.progressShadowWarning
        : themeColors.progressShadow,
    animation: isNearEnd || isSignalPhase ? 'progressPulse 1s ease-in-out infinite' : undefined,
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
          {criticalPhase === 'countdown' && preciseRemaining !== null ? (
            // Countdown mode: show remaining SS:mm
            <span style={timeStyle}>{formatCountdown(preciseRemaining)}</span>
          ) : (
            <>
              <span style={timeStyle}>{formatTime(displayElapsed)}</span>
              <span style={separatorStyle}>/</span>
              <span style={totalTimeStyle}>{formatTime(durationSeconds)}</span>
            </>
          )}
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

        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(253, 224, 71, 0.6); }
          50% { box-shadow: 0 0 40px rgba(253, 224, 71, 0.9), 0 0 60px rgba(253, 224, 71, 0.4); }
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
