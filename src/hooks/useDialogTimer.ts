/**
 * useDialogTimer Hook
 *
 * Countdown-Timer für Dialoge mit Auto-Dismiss Funktionalität.
 * Verwendet für GoalScorerDialog (10s Auto-Close nach Tor-Erfassung).
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §5.1
 *
 * C3a-2a Fixrunde 1 (C1): Der Countdown selbst laeuft in `remainingRef` (reiner `setInterval`-
 * Callback, kein React-Updater) -- `setRemainingSeconds`/`onExpire` werden NUR mit fertigen
 * Werten aufgerufen, nie innerhalb einer funktionalen `setState`-Updater-Form. React ruft eine
 * an `setState` uebergebene Updater-FUNKTION unter `StrictMode` (DEV) zweimal auf, um Unreinheit
 * zu erkennen -- ein darin ausgefuehrter Seiteneffekt (hier: `onExpire()`) lief dadurch zweimal
 * (siehe `useDialogTimer.test.ts`, reproduziert das doppelt gezaehlte Tor beim Auto-Dismiss).
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
  // Authoritative Zaehlung ausserhalb von React-State -- der `setInterval`-Callback selbst wird
  // NIE von React dupliziert (nur React-Updater-Funktionen sind betroffen), Lesen/Schreiben von
  // `remainingRef` ist deshalb sicher, auch unter StrictMode.
  const remainingRef = useRef(durationSeconds);

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

  const clearIntervalIfAny = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Main timer effect
  useEffect(() => {
    clearIntervalIfAny();

    // Don't run if not active or paused
    if (!isActive || paused) {
      return undefined;
    }

    // Start countdown
    intervalRef.current = window.setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) {
        remainingRef.current = 0;
        clearIntervalIfAny();
        setIsActive(false);
        setRemainingSeconds(0);
        // Reiner Funktionsaufruf mit fertigem Wert -- kein `setState`-Updater, kann von React
        // nicht dupliziert werden.
        onExpireRef.current?.();
      } else {
        setRemainingSeconds(remainingRef.current);
      }
    }, 1000);

    return () => {
      clearIntervalIfAny();
    };
  }, [isActive, paused, clearIntervalIfAny]);

  // Auto-start handling
  useEffect(() => {
    if (autoStart && !isActive) {
      remainingRef.current = durationSeconds;
      setIsActive(true);
      setRemainingSeconds(durationSeconds);
    }
  }, [autoStart, durationSeconds, isActive]);

  const reset = useCallback(() => {
    remainingRef.current = durationSeconds;
    setRemainingSeconds(durationSeconds);
    setIsActive(true);
  }, [durationSeconds]);

  const cancel = useCallback(() => {
    setIsActive(false);
    clearIntervalIfAny();
  }, [clearIntervalIfAny]);

  const start = useCallback(() => {
    remainingRef.current = durationSeconds;
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
