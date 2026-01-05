/**
 * useMatchCockpitPro Hook
 *
 * Orchestrates all Match Cockpit Pro features:
 * - Extended timer with netto warning
 * - Sound playback on match end
 * - Haptic feedback
 * - Wake lock
 * - Auto-finish and auto-advance
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MatchCockpitSettings,
  MatchCockpitOverrides,
  MatchSoundPreset,
} from '../types/tournament';
import { useMatchTimerExtended, formatTimerDisplay, type TimerState } from './useMatchTimer';
import { useNettoWarning, type NettoWarningPhase } from './useNettoWarning';
import { useMatchSound } from './useMatchSound';
import { useHapticFeedback } from './useHapticFeedback';
import { useWakeLock } from './useWakeLock';

// =============================================================================
// Types
// =============================================================================

export type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface UseMatchCockpitProProps {
  /** Tournament ID for sound storage */
  tournamentId: string;
  /** Match ID (used for netto warning state) */
  matchId: string | null;
  /** Current match status */
  status: MatchStatus;
  /** Timer start time (ISO string) */
  timerStartTime: string | null | undefined;
  /** Base elapsed seconds (from previous runs) */
  baseElapsedSeconds: number;
  /** Match duration in seconds */
  durationSeconds: number;
  /** Tournament-wide settings */
  settings: MatchCockpitSettings;
  /** Per-match overrides */
  overrides?: MatchCockpitOverrides;
  /** Whether this is a final match */
  isFinalMatch?: boolean;
  /** Callback when timer reaches zero */
  onTimerZero?: () => void;
  /** Callback when match should auto-finish */
  onAutoFinish?: () => void;
}

export interface UseMatchCockpitProReturn {
  // Timer
  /** Formatted timer display string (e.g., "5:00" or "0:00") */
  timerDisplay: string;
  /** Current elapsed seconds */
  elapsedSeconds: number;
  /** Display seconds (countdown or elapsed based on direction) */
  displaySeconds: number;
  /** Whether timer is at zero */
  isAtZero: boolean;
  /** Whether timer is in overtime */
  isOvertime: boolean;
  /** Current timer state */
  timerState: TimerState;

  // Netto Warning
  /** Current netto warning phase */
  nettoWarningPhase: NettoWarningPhase;
  /** Whether netto warning is active */
  isNettoWarningActive: boolean;

  // Sound
  /** Play the match end sound */
  playSound: () => Promise<void>;
  /** Stop any playing sound */
  stopSound: () => void;
  /** Test play the sound */
  testPlaySound: () => Promise<void>;
  /** Whether sound is ready to play */
  isSoundReady: boolean;
  /** Whether audio needs user activation */
  needsAudioActivation: boolean;
  /** Activate audio (must be called from user gesture) */
  activateAudio: () => Promise<void>;

  // Haptic
  /** Trigger haptic feedback */
  triggerHaptic: (pattern: 'tap' | 'goal' | 'warning' | 'matchEnd' | 'timerZero' | 'undo' | 'success' | 'error') => void;

  // Wake Lock
  /** Whether wake lock is active */
  isWakeLockActive: boolean;

  // Settings (effective values with overrides applied)
  /** Effective settings with overrides applied */
  effectiveSettings: {
    soundEnabled: boolean;
    soundId: MatchSoundPreset | null;
    soundVolume: number;
    nettoWarningEnabled: boolean;
    autoFinishEnabled: boolean;
    goldenGoalEnabled: boolean;
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useMatchCockpitPro({
  tournamentId,
  matchId,
  status,
  timerStartTime,
  baseElapsedSeconds,
  durationSeconds,
  settings,
  overrides = {},
  isFinalMatch = false,
  onTimerZero,
  onAutoFinish,
}: UseMatchCockpitProProps): UseMatchCockpitProReturn {
  // Track if timer zero callback has been fired
  const hasFireTimerZero = useRef(false);
  const [hasTriggeredAutoFinish, setHasTriggeredAutoFinish] = useState(false);

  // Apply overrides to settings
  const effectiveSettings = {
    soundEnabled: overrides.soundEnabled ?? settings.soundEnabled,
    soundId: overrides.soundId !== undefined ? overrides.soundId : settings.soundId,
    soundVolume: overrides.soundVolume ?? settings.soundVolume,
    nettoWarningEnabled: overrides.nettoWarningEnabled ?? settings.nettoWarningEnabled,
    autoFinishEnabled: overrides.autoFinishEnabled ?? settings.autoFinishEnabled,
    goldenGoalEnabled: overrides.goldenGoalEnabled ?? (isFinalMatch && settings.finalDecider === 'goldenGoal'),
  };

  // Extended timer hook
  const timerResult = useMatchTimerExtended(
    timerStartTime,
    baseElapsedSeconds,
    status,
    durationSeconds,
    settings.timerDirection,
    effectiveSettings.nettoWarningEnabled ? settings.nettoWarningSeconds : 0
  );

  // Netto warning hook
  const nettoWarning = useNettoWarning(
    timerResult.timerState,
    effectiveSettings.nettoWarningEnabled,
    matchId
  );

  // Sound hook
  const sound = useMatchSound(
    effectiveSettings.soundId,
    effectiveSettings.soundVolume,
    effectiveSettings.soundEnabled,
    tournamentId
  );

  // Haptic feedback hook
  const haptic = useHapticFeedback(settings.hapticEnabled);

  // Wake lock hook (active when match is running)
  const wakeLock = useWakeLock(
    settings.wakeLockEnabled && (status === 'RUNNING' || status === 'PAUSED')
  );

  // Extract stable references from hooks to avoid dependency issues
  const { trigger: triggerHapticFn } = haptic;
  const { play: playSound, isReady: isSoundReady } = sound;

  // Handle timer reaching zero
  useEffect(() => {
    if (timerResult.isAtZero && !hasFireTimerZero.current && status === 'RUNNING') {
      hasFireTimerZero.current = true;

      // Trigger haptic
      triggerHapticFn('timerZero');

      // Play sound
      if (effectiveSettings.soundEnabled && isSoundReady) {
        void playSound();
      }

      // Fire callback
      onTimerZero?.();

      // Auto-finish if enabled
      if (effectiveSettings.autoFinishEnabled && !hasTriggeredAutoFinish) {
        setHasTriggeredAutoFinish(true);
        onAutoFinish?.();
      }
    }
  }, [
    timerResult.isAtZero,
    status,
    triggerHapticFn,
    effectiveSettings.soundEnabled,
    effectiveSettings.autoFinishEnabled,
    isSoundReady,
    playSound,
    onTimerZero,
    onAutoFinish,
    hasTriggeredAutoFinish,
  ]);

  // Reset timer zero flag when match restarts
  useEffect(() => {
    if (status === 'NOT_STARTED') {
      hasFireTimerZero.current = false;
      setHasTriggeredAutoFinish(false);
    }
  }, [status]);

  // Netto warning haptic trigger
  useEffect(() => {
    if (nettoWarning.phase === 'attention') {
      triggerHapticFn('warning');
    }
  }, [nettoWarning.phase, triggerHapticFn]);

  // Format timer display
  const timerDisplay = formatTimerDisplay(timerResult.displaySeconds);

  // Trigger haptic helper
  const triggerHaptic = useCallback(
    (pattern: 'tap' | 'goal' | 'warning' | 'matchEnd' | 'timerZero' | 'undo' | 'success' | 'error') => {
      triggerHapticFn(pattern);
    },
    [triggerHapticFn]
  );

  return {
    // Timer
    timerDisplay,
    elapsedSeconds: timerResult.elapsedSeconds,
    displaySeconds: timerResult.displaySeconds,
    isAtZero: timerResult.isAtZero,
    isOvertime: timerResult.isOvertime,
    timerState: timerResult.timerState,

    // Netto Warning
    nettoWarningPhase: nettoWarning.phase,
    isNettoWarningActive: nettoWarning.phase !== 'none',

    // Sound
    playSound: sound.play,
    stopSound: sound.stop,
    testPlaySound: sound.testPlay,
    isSoundReady: sound.isReady,
    needsAudioActivation: effectiveSettings.soundEnabled && !sound.isActivated,
    activateAudio: sound.activate,

    // Haptic
    triggerHaptic,

    // Wake Lock
    isWakeLockActive: wakeLock.isLocked,

    // Effective Settings
    effectiveSettings,
  };
}

export default useMatchCockpitPro;
