/**
 * useNettoWarning Hook
 *
 * Manages the two-phase netto time warning animation:
 * - Phase 1 (ATTENTION): Pulsing border animation (2x, ~800ms)
 * - Phase 2 (PERSISTENT): Gentle glow effect (continuous)
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.1
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimerState } from './useMatchTimer';

/**
 * Animation phase for netto warning
 */
export type NettoWarningPhase = 'none' | 'attention' | 'persistent';

/**
 * Return type for useNettoWarning
 */
export interface NettoWarningResult {
  /** Current animation phase */
  phase: NettoWarningPhase;
  /** Whether any warning animation is active */
  isActive: boolean;
  /** CSS class name to apply */
  className: string;
  /** Callback when attention animation ends */
  onAttentionAnimationEnd: () => void;
  /** Reset the warning state (e.g., when match resets) */
  reset: () => void;
}

/**
 * Hook for managing netto time warning animation phases
 *
 * @param timerState - Current timer state from useMatchTimerExtended
 * @param enabled - Whether netto warning is enabled (from settings)
 * @param matchId - Current match ID (to reset on match change)
 * @returns Animation state and handlers
 */
export function useNettoWarning(
  timerState: TimerState,
  enabled: boolean,
  matchId: string | null
): NettoWarningResult {
  const [phase, setPhase] = useState<NettoWarningPhase>('none');
  const hasTriggeredRef = useRef(false);
  const lastMatchIdRef = useRef<string | null>(null);

  // Reset when match changes
  useEffect(() => {
    if (matchId !== lastMatchIdRef.current) {
      lastMatchIdRef.current = matchId;
      hasTriggeredRef.current = false;
      setPhase('none');
    }
  }, [matchId]);

  // Trigger Phase 1 when entering netto-warning state
  useEffect(() => {
    if (!enabled) {
      setPhase('none');
      return;
    }

    if (timerState === 'netto-warning' && !hasTriggeredRef.current) {
      // First time entering netto-warning: trigger attention phase
      hasTriggeredRef.current = true;
      setPhase('attention');
    } else if (timerState === 'zero' || timerState === 'overtime') {
      // Timer ended: keep persistent or clear
      if (phase === 'attention') {
        setPhase('persistent');
      }
    } else if (timerState === 'normal') {
      // Back to normal (e.g., time adjusted): reset
      if (phase !== 'none') {
        setPhase('none');
        hasTriggeredRef.current = false;
      }
    }
  }, [timerState, enabled, phase]);

  // Callback when attention animation completes
  const onAttentionAnimationEnd = useCallback(() => {
    if (phase === 'attention') {
      setPhase('persistent');
    }
  }, [phase]);

  // Manual reset function
  const reset = useCallback(() => {
    hasTriggeredRef.current = false;
    setPhase('none');
  }, []);

  // Generate CSS class name
  const className = phase === 'none' ? '' : `netto-warning-${phase}`;

  return {
    phase,
    isActive: phase !== 'none',
    className,
    onAttentionAnimationEnd,
    reset,
  };
}

/**
 * CSS-in-JS styles for netto warning animations
 * Can be used directly or converted to CSS classes
 */
export const nettoWarningStyles = {
  /**
   * Phase 1: Attention-seeking border pulse
   * Applied to timer container
   */
  attention: {
    animation: 'netto-attention-pulse 0.4s ease-in-out 2',
  },

  /**
   * Phase 2: Persistent glow on timer digits
   * Applied to timer text
   */
  persistent: {
    animation: 'netto-persistent-glow 1.5s ease-in-out infinite',
  },
};

/**
 * CSS keyframes as string (for injection into style tag)
 */
export const nettoWarningKeyframes = `
@keyframes netto-attention-pulse {
  0%, 100% {
    box-shadow: inset 0 0 0 0 transparent;
  }
  50% {
    box-shadow: inset 0 0 0 3px var(--color-warning, #ff9800);
  }
}

@keyframes netto-persistent-glow {
  0%, 100% {
    text-shadow: 0 0 4px var(--color-warning, #ff9800);
    opacity: 1;
  }
  50% {
    text-shadow: 0 0 12px var(--color-warning, #ff9800);
    opacity: 0.9;
  }
}

/* Reduced motion: static color instead of animation */
@media (prefers-reduced-motion: reduce) {
  .netto-warning-attention,
  .netto-warning-persistent {
    animation: none !important;
  }

  .netto-warning-attention {
    box-shadow: inset 0 0 0 2px var(--color-warning, #ff9800);
  }

  .netto-warning-persistent {
    color: var(--color-warning, #ff9800);
  }
}
`;
