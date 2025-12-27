/**
 * useDialogTimer Hook
 *
 * Countdown-Timer für Dialoge mit Auto-Dismiss Funktionalität.
 * Verwendet für GoalScorerDialog (10s Auto-Close nach Tor-Erfassung).
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.1
 *
 * @example
 * const { remainingSeconds, reset, cancel, isActive } = useDialogTimer({
 *   durationSeconds: 10,
 *   onExpire: () => handleSkip(),
 *   autoStart: isOpen,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseDialogTimerOptions {
  /** Timer-Dauer in Sekunden (default: 10) */
  durationSeconds?: number;
  /** Callback wenn Timer abläuft */
  onExpire?: () => void;
  /** Automatisch starten wenn true (default: false) */
  autoStart?: boolean;
  /** Timer pausieren wenn true */
  paused?: boolean;
}

interface UseDialogTimerReturn {
  /** Verbleibende Sekunden */
  remainingSeconds: number;
  /** Timer zurücksetzen auf Startzeit */
  reset: () => void;
  /** Timer abbrechen (stoppt und setzt isActive auf false) */
  cancel: () => void;
  /** Timer starten */
  start: () => void;
  /** true wenn Timer läuft */
  isActive: boolean;
  /** Fortschritt als Prozent (0-100), 100 = voll, 0 = abgelaufen */
  progressPercent: number;
}

export function useDialogTimer({
  durationSeconds = 10,
  onExpire,
  autoStart = false,
  paused = false,
}: UseDialogTimerOptions = {}): UseDialogTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isActive, setIsActive] = useState(autoStart);
  const intervalRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  // Keep onExpire ref current to avoid stale closures
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Main timer effect
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't run if not active or paused
    if (!isActive || paused) {
      return;
    }

    // Start countdown
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Timer expired
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsActive(false);
          // Call onExpire callback
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, paused]);

  // Auto-start handling
  useEffect(() => {
    if (autoStart && !isActive) {
      setIsActive(true);
      setRemainingSeconds(durationSeconds);
    }
  }, [autoStart, durationSeconds, isActive]);

  const reset = useCallback(() => {
    setRemainingSeconds(durationSeconds);
    setIsActive(true);
  }, [durationSeconds]);

  const cancel = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setRemainingSeconds(durationSeconds);
    setIsActive(true);
  }, [durationSeconds]);

  const progressPercent = Math.round((remainingSeconds / durationSeconds) * 100);

  return {
    remainingSeconds,
    reset,
    cancel,
    start,
    isActive,
    progressPercent,
  };
}

export default useDialogTimer;
