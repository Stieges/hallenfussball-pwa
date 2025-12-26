/**
 * NextMatchPreview - Upcoming match preview banner for monitor view
 *
 * Features:
 * - Shows when remaining time < 3 minutes AND current match is RUNNING
 * - Displays for 7 seconds, then fades out
 * - Does NOT show when: paused, no next match, or already finished
 * - Slide-up animation from bottom
 */

import { CSSProperties, useEffect, useState, useCallback, useRef } from 'react';
import { colors, fontFamilies, fontWeights, spacing } from '../../design-tokens';
import { MatchStatus } from '../../hooks/useLiveMatches';

export interface NextMatch {
  id: string;
  number: number;
  homeTeam: string;
  awayTeam: string;
  field?: number;
  group?: string;
  scheduledTime?: string;
}

export interface NextMatchPreviewProps {
  /** Next match to display */
  nextMatch: NextMatch | null;
  /** Current match status */
  currentMatchStatus: MatchStatus;
  /** Remaining seconds in current match */
  remainingSeconds: number;
  /** Threshold to show preview (default: 180 = 3 min) */
  showThresholdSeconds?: number;
  /** Duration to show the preview (default: 7000ms) */
  displayDuration?: number;
}

export const NextMatchPreview: React.FC<NextMatchPreviewProps> = ({
  nextMatch,
  currentMatchStatus,
  remainingSeconds,
  showThresholdSeconds = 180,
  displayDuration = 7000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const hasShownRef = useRef(false);
  const hideTimeoutRef = useRef<number | null>(null);

  /**
   * Clear timeout
   */
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * Check if preview should be shown
   */
  const shouldShow = useCallback(() => {
    // Must have a next match
    if (!nextMatch) {return false;}

    // Current match must be running (not paused, not finished)
    if (currentMatchStatus !== 'RUNNING') {return false;}

    // Remaining time must be below threshold
    if (remainingSeconds > showThresholdSeconds) {return false;}

    // Must have positive remaining time (not in overtime)
    if (remainingSeconds <= 0) {return false;}

    return true;
  }, [nextMatch, currentMatchStatus, remainingSeconds, showThresholdSeconds]);

  /**
   * Handle visibility logic
   */
  useEffect(() => {
    const canShow = shouldShow();

    if (canShow && !hasShownRef.current && !isVisible) {
      // Show the preview
      setIsVisible(true);
      hasShownRef.current = true;

      // Schedule hide
      clearHideTimeout();
      hideTimeoutRef.current = window.setTimeout(() => {
        setIsAnimatingOut(true);
        setTimeout(() => {
          setIsVisible(false);
          setIsAnimatingOut(false);
        }, 300);
      }, displayDuration);
    }

    // Reset when match ends or threshold is exceeded again
    if (!canShow && hasShownRef.current && !isVisible) {
      hasShownRef.current = false;
    }

    return () => clearHideTimeout();
  }, [shouldShow, isVisible, displayDuration, clearHideTimeout]);

  // Reset when next match changes
  useEffect(() => {
    hasShownRef.current = false;
    setIsVisible(false);
    setIsAnimatingOut(false);
    clearHideTimeout();
  }, [nextMatch?.id, clearHideTimeout]);

  if (!isVisible || !nextMatch) {
    return null;
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 100%)',
    borderTop: `3px solid ${colors.accent}`,
    animation: isAnimatingOut
      ? 'slideDown 0.3s ease-out forwards'
      : 'slideUp 0.4s ease-out',
    zIndex: 1500,
  };

  const contentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const labelStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: fontWeights.bold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const announcementIconStyle: CSSProperties = {
    fontSize: '24px',
  };

  const matchupStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.lg,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
  };

  const vsStyle: CSSProperties = {
    fontSize: '20px',
    fontWeight: fontWeights.medium,
    color: colors.textSecondary,
  };

  const metaStyle: CSSProperties = {
    fontSize: '16px',
    color: colors.textSecondary,
  };

  const estimatedMinutes = Math.ceil(remainingSeconds / 60);

  return (
    <>
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={labelStyle}>
            <span style={announcementIconStyle}>📢</span>
            <span>Nächstes Spiel in ~{estimatedMinutes} Min</span>
          </div>

          <div style={matchupStyle}>
            <span style={teamNameStyle}>{nextMatch.homeTeam}</span>
            <span style={vsStyle}>vs</span>
            <span style={teamNameStyle}>{nextMatch.awayTeam}</span>
          </div>

          <div style={metaStyle}>
            {nextMatch.field && `Feld ${nextMatch.field} · `}
            Spiel {nextMatch.number}
            {nextMatch.group && ` · Gruppe ${nextMatch.group}`}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideDown {
          0% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(100%);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          @keyframes slideUp {
            0% { opacity: 0; transform: none; }
            100% { opacity: 1; transform: none; }
          }
          @keyframes slideDown {
            0% { opacity: 1; transform: none; }
            100% { opacity: 0; transform: none; }
          }
        }

        @media (max-width: 768px) {
          /* Stack content vertically on mobile */
        }
      `}</style>
    </>
  );
};

/**
 * Hook to calculate remaining seconds for a match
 */
export function useRemainingSeconds(
  elapsedSeconds: number,
  durationSeconds: number
): number {
  return Math.max(0, durationSeconds - elapsedSeconds);
}
