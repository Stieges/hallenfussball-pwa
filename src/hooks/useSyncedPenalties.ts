/**
 * useSyncedPenalties - Time Penalty Sync with Game Timer
 *
 * Manages time penalties that pause/resume with the game timer.
 * When the match timer is paused, all active penalties are also paused.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §3.4
 *
 * Features:
 * - Penalties pause when game timer pauses
 * - Penalties resume when game timer resumes
 * - Accurate remaining time calculation
 * - Callback when penalty expires
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ActivePenalty {
  id: string;
  teamId: string;
  playerNumber?: number;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: number; // timestamp when penalty started
  pausedAt?: number; // timestamp when last paused (if paused)
  isPaused: boolean;
}

interface UseSyncedPenaltiesOptions {
  /** Whether the game timer is currently running */
  isGameRunning: boolean;
  /** Callback when a penalty expires */
  onPenaltyExpired?: (penaltyId: string) => void;
  /** Update interval in ms (default: 1000) */
  updateInterval?: number;
}

interface UseSyncedPenaltiesReturn {
  /** List of active penalties */
  activePenalties: ActivePenalty[];
  /** Add a new penalty */
  addPenalty: (teamId: string, durationSeconds: number, playerNumber?: number) => string;
  /** Remove a penalty (e.g., when goal scored) */
  removePenalty: (penaltyId: string) => void;
  /** Clear all penalties */
  clearAllPenalties: () => void;
  /** Get penalty by ID */
  getPenalty: (penaltyId: string) => ActivePenalty | undefined;
  /** Number of active penalties for a team */
  getTeamPenaltyCount: (teamId: string) => number;
}

let penaltyIdCounter = 0;

export function useSyncedPenalties({
  isGameRunning,
  onPenaltyExpired,
  updateInterval = 1000,
}: UseSyncedPenaltiesOptions): UseSyncedPenaltiesReturn {
  const [penalties, setPenalties] = useState<ActivePenalty[]>([]);
  const wasRunningRef = useRef(isGameRunning);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle game pause/resume
  useEffect(() => {
    const now = Date.now();

    if (wasRunningRef.current && !isGameRunning) {
      // Game just paused - pause all active penalties
      setPenalties(prev =>
        prev.map(penalty => ({
          ...penalty,
          isPaused: true,
          pausedAt: now,
        }))
      );
    } else if (!wasRunningRef.current && isGameRunning) {
      // Game just resumed - resume all paused penalties
      setPenalties(prev =>
        prev.map(penalty => {
          if (penalty.isPaused && penalty.pausedAt) {
            // Adjust startedAt to account for pause duration
            const pauseDuration = now - penalty.pausedAt;
            return {
              ...penalty,
              isPaused: false,
              pausedAt: undefined,
              startedAt: penalty.startedAt + pauseDuration,
            };
          }
          return penalty;
        })
      );
    }

    wasRunningRef.current = isGameRunning;
  }, [isGameRunning]);

  // Update remaining times
  useEffect(() => {
    if (!isGameRunning) {
      // Clear interval when game is paused
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const updatePenalties = () => {
      const now = Date.now();

      setPenalties(prev => {
        const updated: ActivePenalty[] = [];
        const expired: string[] = [];

        for (const penalty of prev) {
          if (penalty.isPaused) {
            updated.push(penalty);
            continue;
          }

          const elapsedSeconds = Math.floor((now - penalty.startedAt) / 1000);
          const remaining = Math.max(0, penalty.durationSeconds - elapsedSeconds);

          if (remaining <= 0) {
            expired.push(penalty.id);
          } else {
            updated.push({
              ...penalty,
              remainingSeconds: remaining,
            });
          }
        }

        // Notify about expired penalties
        expired.forEach(id => {
          onPenaltyExpired?.(id);
        });

        return updated;
      });
    };

    // Initial update
    updatePenalties();

    // Set up interval
    intervalRef.current = setInterval(updatePenalties, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isGameRunning, updateInterval, onPenaltyExpired]);

  const addPenalty = useCallback((
    teamId: string,
    durationSeconds: number,
    playerNumber?: number
  ): string => {
    const id = `penalty-${++penaltyIdCounter}-${Date.now()}`;
    const now = Date.now();

    const newPenalty: ActivePenalty = {
      id,
      teamId,
      playerNumber,
      durationSeconds,
      remainingSeconds: durationSeconds,
      startedAt: now,
      isPaused: !isGameRunning,
      pausedAt: !isGameRunning ? now : undefined,
    };

    setPenalties(prev => [...prev, newPenalty]);
    return id;
  }, [isGameRunning]);

  const removePenalty = useCallback((penaltyId: string) => {
    setPenalties(prev => prev.filter(p => p.id !== penaltyId));
  }, []);

  const clearAllPenalties = useCallback(() => {
    setPenalties([]);
  }, []);

  const getPenalty = useCallback((penaltyId: string) => {
    return penalties.find(p => p.id === penaltyId);
  }, [penalties]);

  const getTeamPenaltyCount = useCallback((teamId: string) => {
    return penalties.filter(p => p.teamId === teamId).length;
  }, [penalties]);

  return {
    activePenalties: penalties,
    addPenalty,
    removePenalty,
    clearAllPenalties,
    getPenalty,
    getTeamPenaltyCount,
  };
}

export default useSyncedPenalties;
