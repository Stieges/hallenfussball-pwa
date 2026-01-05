/**
 * useMatchTimer Hook
 *
 * Custom Hook für präzise Timer-Anzeige ohne State-Kaskaden.
 * Verwendet requestAnimationFrame für flüssige Updates.
 *
 * MF-002: Performance-Optimierung - Timer wird lokal berechnet
 * statt über globale State-Updates.
 *
 * Match Cockpit Pro: Extended with countdown support and timer state
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { TimerDirection } from '../types/tournament';

type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

/**
 * Timer state for UI display and logic
 */
export type TimerState = 'normal' | 'netto-warning' | 'zero' | 'overtime';

/**
 * Extended return type for useMatchTimerExtended
 */
export interface MatchTimerResult {
  /** Seconds to display (countdown: remaining, elapsed: passed) */
  displaySeconds: number;
  /** Raw elapsed seconds (always counts up from 0) */
  elapsedSeconds: number;
  /** Timer has reached 00:00 (only relevant for countdown) */
  isAtZero: boolean;
  /** Timer is in overtime (elapsed > duration) */
  isOvertime: boolean;
  /** Current timer state for styling */
  timerState: TimerState;
  /** Remaining seconds until netto warning (for progress calculations) */
  secondsUntilNettoWarning: number | null;
}

/**
 * Hook für lokale Timer-Berechnung basierend auf timerStartTime
 *
 * @param timerStartTime - ISO-Timestamp wann der Timer gestartet wurde
 * @param baseElapsedSeconds - Bereits vergangene Sekunden vor dem aktuellen Timer-Start
 * @param status - Aktueller Match-Status
 * @returns Aktuelle verstrichene Sekunden für die Anzeige
 *
 * @deprecated Use useMatchTimerExtended for new code
 */
export function useMatchTimer(
  timerStartTime: string | null | undefined,
  baseElapsedSeconds: number,
  status: MatchStatus
): number {
  const [displayTime, setDisplayTime] = useState(baseElapsedSeconds);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Wenn nicht RUNNING, zeige die gespeicherte Zeit
    if (status !== 'RUNNING' || !timerStartTime) {
      setDisplayTime(baseElapsedSeconds);
      return;
    }

    const startTime = new Date(timerStartTime).getTime();
    let animationFrameId: number;

    const updateTimer = () => {
      const now = Date.now();

      // Nur jede Sekunde aktualisieren (Performance)
      const currentSecond = Math.floor(now / 1000);
      if (currentSecond !== lastUpdateRef.current) {
        lastUpdateRef.current = currentSecond;

        const runtimeMs = now - startTime;
        const runtimeSeconds = Math.floor(runtimeMs / 1000);
        const totalElapsed = baseElapsedSeconds + runtimeSeconds;

        setDisplayTime(totalElapsed);
      }

      animationFrameId = requestAnimationFrame(updateTimer);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [timerStartTime, baseElapsedSeconds, status]);

  return displayTime;
}

/**
 * Extended match timer hook with countdown support and state tracking
 *
 * @param timerStartTime - ISO-Timestamp when timer was started
 * @param baseElapsedSeconds - Elapsed seconds before current run/pause
 * @param status - Current match status
 * @param durationSeconds - Total match duration in seconds
 * @param direction - Timer direction: 'countdown' (10:00→00:00) or 'elapsed' (00:00→10:00)
 * @param nettoWarningSeconds - Seconds remaining when netto warning triggers (e.g., 120)
 * @returns Extended timer result with display value and state
 */
export function useMatchTimerExtended(
  timerStartTime: string | null | undefined,
  baseElapsedSeconds: number,
  status: MatchStatus,
  durationSeconds: number,
  direction: TimerDirection = 'countdown',
  nettoWarningSeconds: number = 120
): MatchTimerResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(baseElapsedSeconds);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // When not RUNNING, show the stored time
    if (status !== 'RUNNING' || !timerStartTime) {
      setElapsedSeconds(baseElapsedSeconds);
      return;
    }

    const startTime = new Date(timerStartTime).getTime();
    let animationFrameId: number;

    const updateTimer = () => {
      const now = Date.now();

      // Only update every second (performance optimization)
      const currentSecond = Math.floor(now / 1000);
      if (currentSecond !== lastUpdateRef.current) {
        lastUpdateRef.current = currentSecond;

        const runtimeMs = now - startTime;
        const runtimeSeconds = Math.floor(runtimeMs / 1000);
        const totalElapsed = baseElapsedSeconds + runtimeSeconds;

        setElapsedSeconds(totalElapsed);
      }

      animationFrameId = requestAnimationFrame(updateTimer);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [timerStartTime, baseElapsedSeconds, status]);

  // Calculate derived values
  const result = useMemo((): MatchTimerResult => {
    const isOvertime = elapsedSeconds > durationSeconds;
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
    const isAtZero = remainingSeconds === 0 && !isOvertime;

    // Display seconds depend on direction
    const displaySeconds = direction === 'countdown'
      ? remainingSeconds
      : elapsedSeconds;

    // Determine timer state
    let timerState: TimerState = 'normal';
    if (isOvertime) {
      timerState = 'overtime';
    } else if (isAtZero) {
      timerState = 'zero';
    } else if (remainingSeconds <= nettoWarningSeconds && remainingSeconds > 0) {
      timerState = 'netto-warning';
    }

    // Calculate seconds until netto warning triggers
    const secondsUntilNettoWarning = remainingSeconds > nettoWarningSeconds
      ? remainingSeconds - nettoWarningSeconds
      : null;

    return {
      displaySeconds,
      elapsedSeconds,
      isAtZero,
      isOvertime,
      timerState,
      secondsUntilNettoWarning,
    };
  }, [elapsedSeconds, durationSeconds, direction, nettoWarningSeconds]);

  return result;
}

/**
 * Format seconds to MM:SS string
 */
export function formatTimerDisplay(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
