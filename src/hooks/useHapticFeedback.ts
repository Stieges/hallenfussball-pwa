/**
 * useHapticFeedback Hook
 *
 * Provides haptic feedback (vibration) for match events.
 * Uses the Vibration API with different patterns for different events.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.4
 */

import { useCallback, useMemo } from 'react';

/**
 * Vibration patterns for different events (in milliseconds)
 * Format: [vibrate, pause, vibrate, pause, ...]
 */
export const HAPTIC_PATTERNS = {
  /** Short single pulse for button feedback */
  tap: [50],
  /** Double pulse for goal scored */
  goal: [100, 50, 100],
  /** Long pulse for match end warning */
  warning: [200, 100, 200],
  /** Triple pulse for match finished */
  matchEnd: [100, 50, 100, 50, 200],
  /** Strong pulse for timer at zero */
  timerZero: [300, 100, 300],
  /** Light pulse for undo action */
  undo: [30],
  /** Success pattern for confirmation */
  success: [50, 30, 100],
  /** Error pattern for failed action */
  error: [100, 50, 100, 50, 100],
} as const;

export type HapticPattern = keyof typeof HAPTIC_PATTERNS;

/**
 * Return type for useHapticFeedback
 */
export interface UseHapticFeedbackReturn {
  /** Trigger haptic feedback with a specific pattern */
  trigger: (pattern: HapticPattern) => void;
  /** Whether haptic feedback is supported */
  isSupported: boolean;
  /** Cancel any ongoing vibration */
  cancel: () => void;
}

/**
 * Hook for haptic feedback
 *
 * @param enabled - Whether haptic feedback is enabled
 */
export function useHapticFeedback(enabled: boolean): UseHapticFeedbackReturn {
  // Check if Vibration API is supported
  const isSupported = useMemo(() => {
    return 'vibrate' in navigator;
  }, []);

  // Trigger haptic feedback
  const trigger = useCallback(
    (pattern: HapticPattern) => {
      if (!enabled || !isSupported) {
        return;
      }

      try {
        const vibrationPattern = HAPTIC_PATTERNS[pattern];
        navigator.vibrate(vibrationPattern);
      } catch (err) {
        // Silently fail - haptic is a nice-to-have, not critical
        console.warn('[useHapticFeedback] Vibration failed:', err);
      }
    },
    [enabled, isSupported]
  );

  // Cancel ongoing vibration
  const cancel = useCallback(() => {
    if (isSupported) {
      try {
        navigator.vibrate(0);
      } catch {
        // Silently fail
      }
    }
  }, [isSupported]);

  return {
    trigger,
    isSupported,
    cancel,
  };
}
