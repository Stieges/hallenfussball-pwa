/**
 * useHaptic - Haptic Feedback Hook
 *
 * Provides haptic feedback (vibration) for touch interactions.
 * Falls back gracefully on devices that don't support the Vibration API.
 *
 * @example
 * ```tsx
 * const { triggerHaptic } = useHaptic();
 *
 * // Light tap feedback
 * onClick={() => { triggerHaptic('light'); doSomething(); }}
 *
 * // Success feedback
 * onClick={() => { triggerHaptic('success'); save(); }}
 *
 * // Error feedback
 * onClick={() => { triggerHaptic('error'); showError(); }}
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 */

import { useCallback } from 'react';

/**
 * Haptic feedback types with their vibration patterns
 *
 * Patterns are in milliseconds: [vibrate, pause, vibrate, ...]
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection';

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  /** Light tap - single short vibration (10ms) */
  light: 10,
  /** Medium tap - slightly longer (25ms) */
  medium: 25,
  /** Heavy tap - longer vibration (50ms) */
  heavy: 50,
  /** Success - two quick pulses */
  success: [10, 50, 10],
  /** Error - three quick pulses */
  error: [50, 30, 50, 30, 50],
  /** Warning - two medium pulses */
  warning: [30, 50, 30],
  /** Selection change - ultra-light (5ms) */
  selection: 5,
};

/**
 * Check if the Vibration API is available
 */
const isVibrationSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Trigger a haptic vibration
 *
 * @param pattern - Vibration pattern (ms or array of ms)
 * @returns true if vibration was triggered, false if not supported
 */
const vibrate = (pattern: number | number[]): boolean => {
  if (!isVibrationSupported()) {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch {
    // Vibration might fail in some contexts (e.g., no user interaction)
    return false;
  }
};

export interface UseHapticResult {
  /** Trigger haptic feedback */
  triggerHaptic: (type?: HapticType) => void;
  /** Check if haptic feedback is supported */
  isSupported: boolean;
}

/**
 * Hook for haptic feedback
 *
 * @returns Object with triggerHaptic function and isSupported flag
 */
export const useHaptic = (): UseHapticResult => {
  const isSupported = isVibrationSupported();

  const triggerHaptic = useCallback((type: HapticType = 'light') => {
    const pattern = HAPTIC_PATTERNS[type];
    vibrate(pattern);
  }, []);

  return {
    triggerHaptic,
    isSupported,
  };
};

/**
 * Standalone function to trigger haptic feedback
 * Use this when you don't need the hook (e.g., in utilities)
 *
 * @param type - Type of haptic feedback
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  const pattern = HAPTIC_PATTERNS[type];
  vibrate(pattern);
};

export default useHaptic;
