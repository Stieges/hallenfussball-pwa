/**
 * Haptic Feedback Utilities
 *
 * Provides cross-browser haptic feedback using the Vibration API.
 * Falls back gracefully when not supported.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §6.1
 *
 * Usage:
 * - triggerHaptic('light')   - Short, subtle feedback (button tap)
 * - triggerHaptic('medium')  - Medium feedback (action confirmed)
 * - triggerHaptic('heavy')   - Strong feedback (important action)
 * - triggerHaptic('success') - Pattern for successful actions
 * - triggerHaptic('error')   - Pattern for errors/warnings
 * - triggerHaptic('warning') - Pattern for warnings
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

// Vibration patterns in milliseconds
const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 30], // short-pause-medium
  error: [50, 30, 50, 30, 50], // three strong pulses
  warning: [30, 50, 30], // two medium pulses
};

/**
 * Check if the Vibration API is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with the specified type
 * @param type - The type of haptic feedback
 * @returns true if vibration was triggered, false if not supported
 */
export function triggerHaptic(type: HapticType = 'light'): boolean {
  if (!isHapticSupported()) {
    return false;
  }

  try {
    const pattern = HAPTIC_PATTERNS[type];
    navigator.vibrate(pattern);
    return true;
  } catch {
    // Vibration might be blocked by browser policy
    return false;
  }
}

/**
 * Trigger a custom vibration pattern
 * @param pattern - Array of milliseconds (vibrate, pause, vibrate, pause, ...)
 * @returns true if vibration was triggered, false if not supported
 */
export function triggerCustomHaptic(pattern: number[]): boolean {
  if (!isHapticSupported()) {
    return false;
  }

  try {
    navigator.vibrate(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop any ongoing vibration
 */
export function stopHaptic(): void {
  if (isHapticSupported()) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Hook-friendly haptic trigger that can be used in event handlers
 * Creates stable callback references for common haptic types
 */
export const hapticCallbacks = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  heavy: () => triggerHaptic('heavy'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
} as const;

export default {
  trigger: triggerHaptic,
  triggerCustom: triggerCustomHaptic,
  stop: stopHaptic,
  isSupported: isHapticSupported,
  callbacks: hapticCallbacks,
};
