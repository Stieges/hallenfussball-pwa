/**
 * useMatchSound Hook
 *
 * Manages sound playback for match events (timer end, goals, etc.).
 * Handles preloading, volume control, and browser autoplay restrictions.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.3
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatchSoundPreset } from '../types/tournament';
import { getCustomSoundUrl } from '../utils/soundStorage';

/**
 * Sound preset URLs (relative to public folder)
 */
const PRESET_SOUNDS: Record<Exclude<MatchSoundPreset, 'custom'>, string> = {
  'horn-1': '/sounds/horn-1.mp3',
  'horn-2': '/sounds/horn-2.mp3',
  'horn-3': '/sounds/horn-3.mp3',
};

/**
 * Return type for useMatchSound
 */
export interface UseMatchSoundReturn {
  /** Play the selected sound */
  play: () => Promise<void>;
  /** Stop any currently playing sound */
  stop: () => void;
  /** Test play the sound (respects volume) */
  testPlay: () => Promise<void>;
  /** Whether the sound is currently playing */
  isPlaying: boolean;
  /** Whether sound is ready to play (loaded) */
  isReady: boolean;
  /** Whether audio has been activated by user interaction */
  isActivated: boolean;
  /** Activate audio context (must be called from user interaction) */
  activate: () => Promise<void>;
  /** Error message if sound failed to load/play */
  error: string | null;
}

/**
 * Hook for managing match end sounds
 *
 * @param soundId - Sound preset ID or 'custom'
 * @param volume - Volume level (0-100)
 * @param enabled - Whether sound is enabled
 * @param tournamentId - Tournament ID (for custom sound lookup)
 */
export function useMatchSound(
  soundId: MatchSoundPreset | null,
  volume: number,
  enabled: boolean,
  tournamentId: string
): UseMatchSoundReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const customUrlRef = useRef<string | null>(null);

  // Load sound when soundId or tournamentId changes
  useEffect(() => {
    if (!enabled || !soundId) {
      setIsReady(false);
      return;
    }

    let isMounted = true;

    async function loadSound() {
      setIsReady(false);
      setError(null);

      try {
        let soundUrl: string;

        if (soundId === 'custom') {
          // Load custom sound from IndexedDB
          const url = await getCustomSoundUrl(tournamentId);
          if (!url) {
            setError('Kein eigener Sound hochgeladen');
            return;
          }
          // Revoke previous custom URL if exists
          if (customUrlRef.current) {
            URL.revokeObjectURL(customUrlRef.current);
          }
          customUrlRef.current = url;
          soundUrl = url;
        } else if (soundId && soundId in PRESET_SOUNDS) {
          // Use preset sound
          soundUrl = PRESET_SOUNDS[soundId as keyof typeof PRESET_SOUNDS];
        } else {
          setError('Unbekannter Sound');
          return;
        }

        // Create or update audio element
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        audioRef.current.src = soundUrl;
        audioRef.current.volume = volume / 100;
        audioRef.current.preload = 'auto';

        // Wait for audio to be loadable
        await new Promise<void>((resolve, reject) => {
          if (!audioRef.current) {
            reject(new Error('No audio element'));
            return;
          }

          const onCanPlay = () => {
            audioRef.current?.removeEventListener('canplaythrough', onCanPlay);
            audioRef.current?.removeEventListener('error', onError);
            resolve();
          };

          const onError = () => {
            audioRef.current?.removeEventListener('canplaythrough', onCanPlay);
            audioRef.current?.removeEventListener('error', onError);
            reject(new Error('Failed to load audio'));
          };

          audioRef.current.addEventListener('canplaythrough', onCanPlay);
          audioRef.current.addEventListener('error', onError);

          // Trigger load
          audioRef.current.load();
        });

        if (isMounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[useMatchSound] Failed to load sound:', err);
        if (isMounted) {
          setError('Sound konnte nicht geladen werden');
        }
      }
    }

    void loadSound();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- volume is handled by separate effect
  }, [soundId, tournamentId, enabled]);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Cleanup custom URL on unmount
  useEffect(() => {
    return () => {
      if (customUrlRef.current) {
        URL.revokeObjectURL(customUrlRef.current);
      }
    };
  }, []);

  // Activate audio context (must be called from user gesture)
  const activate = useCallback(async () => {
    try {
      // Create a silent audio element and play it to unlock audio
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      silentAudio.volume = 0;
      await silentAudio.play();
      silentAudio.pause();
      setIsActivated(true);
    } catch (err) {
      console.warn('[useMatchSound] Audio activation failed:', err);
      // Still mark as activated - some browsers don't require it
      setIsActivated(true);
    }
  }, []);

  // Play the sound
  const play = useCallback(async () => {
    if (!enabled || !isReady || !audioRef.current) {
      return;
    }

    try {
      // Reset to start if already playing
      audioRef.current.currentTime = 0;
      setIsPlaying(true);

      await audioRef.current.play();

      // Wait for sound to finish
      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    } catch (err) {
      console.error('[useMatchSound] Failed to play sound:', err);
      setIsPlaying(false);
      setError('Sound konnte nicht abgespielt werden');
    }
  }, [enabled, isReady]);

  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  // Test play (same as play but always tries)
  const testPlay = useCallback(async () => {
    if (!audioRef.current) {
      return;
    }

    try {
      audioRef.current.currentTime = 0;
      setIsPlaying(true);
      await audioRef.current.play();
      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    } catch (err) {
      console.error('[useMatchSound] Test play failed:', err);
      setIsPlaying(false);
    }
  }, []);

  return {
    play,
    stop,
    testPlay,
    isPlaying,
    isReady,
    isActivated,
    activate,
    error,
  };
}

/**
 * Hook for managing multiple sounds across tabs via BroadcastChannel
 */
export function useMatchSoundSync(tournamentId: string): {
  broadcastPlay: (soundId: MatchSoundPreset, volume: number) => void;
} {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(`match-sound-${tournamentId}`);

    return () => {
      channelRef.current?.close();
    };
  }, [tournamentId]);

  const broadcastPlay = useCallback((soundId: MatchSoundPreset, volume: number) => {
    channelRef.current?.postMessage({
      type: 'PLAY_SOUND',
      soundId,
      volume,
    });
  }, []);

  return { broadcastPlay };
}
