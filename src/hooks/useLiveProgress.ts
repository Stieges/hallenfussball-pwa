/**
 * useLiveProgress Hook
 *
 * Calculates live progress for a match in real-time.
 * Used for ProgressRing in the schedule view.
 *
 * @example
 * ```tsx
 * const { progress, elapsedFormatted, isLive } = useLiveProgress(match);
 *
 * return (
 *   <ProgressRing progress={progress} animated={isLive}>
 *     <ScoreContent
 *       homeScore={match.homeScore}
 *       awayScore={match.awayScore}
 *       timer={elapsedFormatted}
 *       isLive={isLive}
 *     />
 *   </ProgressRing>
 * );
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { MatchStatus } from './useLiveMatches';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseLiveProgressReturn {
  /** Progress value between 0 and 1 */
  progress: number;
  /** Current elapsed seconds (updates in real-time for running matches) */
  elapsedSeconds: number;
  /** Formatted elapsed time (e.g., "07:30") */
  elapsedFormatted: string;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Formatted total duration (e.g., "10:00") */
  durationFormatted: string;
  /** Whether the match is currently running */
  isLive: boolean;
  /** Match status */
  status: MatchStatus;
}

export interface ProgressMatch {
  id: string;
  status: MatchStatus;
  durationSeconds: number;
  timerStartTime?: string;
  timerPausedAt?: string;
  timerElapsedSeconds?: number;
  elapsedSeconds?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds to MM:SS string
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate elapsed seconds based on timer fields
 */
function calculateElapsedSeconds(match: ProgressMatch): number {
  if (match.status === 'NOT_STARTED') {
    return 0;
  }

  if (match.status === 'FINISHED') {
    return match.durationSeconds;
  }

  if (match.status === 'PAUSED' || !match.timerStartTime) {
    return match.timerElapsedSeconds ?? match.elapsedSeconds ?? 0;
  }

  // RUNNING: Calculate from timestamp
  const startTime = new Date(match.timerStartTime).getTime();
  const now = Date.now();
  const runtimeSeconds = Math.floor((now - startTime) / 1000);
  return (match.timerElapsedSeconds ?? 0) + runtimeSeconds;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for calculating live match progress
 *
 * @param match - Match object with timer fields
 * @param updateInterval - Update interval in ms for running matches (default: 1000)
 * @returns Progress information
 */
export function useLiveProgress(
  match: ProgressMatch | null | undefined,
  updateInterval = 1000
): UseLiveProgressReturn {
  // Calculate initial elapsed seconds
  const getElapsed = useCallback(() => {
    if (!match) {
      return 0;
    }
    return calculateElapsedSeconds(match);
  }, [match]);

  const [elapsedSeconds, setElapsedSeconds] = useState(getElapsed);

  // Update elapsed seconds in real-time for running matches
  useEffect(() => {
    if (!match) {
      return;
    }

    // Update immediately when match changes
    setElapsedSeconds(getElapsed());

    // Only set up interval for running matches
    if (match.status !== 'RUNNING') {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsedSeconds(match));
    }, updateInterval);

    return () => clearInterval(interval);
  }, [match, updateInterval, getElapsed]);

  // Calculate derived values
  const result = useMemo((): UseLiveProgressReturn => {
    if (!match) {
      return {
        progress: 0,
        elapsedSeconds: 0,
        elapsedFormatted: '00:00',
        durationSeconds: 0,
        durationFormatted: '00:00',
        isLive: false,
        status: 'NOT_STARTED',
      };
    }

    const duration = match.durationSeconds;
    const progress = duration > 0 ? Math.min(1, elapsedSeconds / duration) : 0;
    const isLive = match.status === 'RUNNING';

    return {
      progress,
      elapsedSeconds,
      elapsedFormatted: formatTime(elapsedSeconds),
      durationSeconds: duration,
      durationFormatted: formatTime(duration),
      isLive,
      status: match.status,
    };
  }, [match, elapsedSeconds]);

  return result;
}

// ---------------------------------------------------------------------------
// Utility Export
// ---------------------------------------------------------------------------

export { formatTime };

export default useLiveProgress;
