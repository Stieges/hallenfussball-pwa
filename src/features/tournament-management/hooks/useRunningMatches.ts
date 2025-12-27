/**
 * useRunningMatches - Polls localStorage for currently running match IDs
 *
 * MON-LIVE-INDICATOR-01: Detects matches with status 'RUNNING' to show live indicators
 * Polls every 2 seconds and listens for cross-tab storage events.
 */

import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../../../constants/storage';
import { LiveMatch } from '../../../components/match-cockpit/MatchCockpit';

// Type for stored live matches in localStorage
type StoredLiveMatches = Record<string, LiveMatch>;

/**
 * Gets running match IDs from localStorage
 */
const getRunningMatchIds = (tournamentId: string): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.liveMatches(tournamentId));
    if (stored) {
      const liveMatches = JSON.parse(stored) as StoredLiveMatches;
      const runningIds = Object.keys(liveMatches).filter(
        id => liveMatches[id].status === 'RUNNING'
      );
      return new Set(runningIds);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
};

interface UseRunningMatchesOptions {
  tournamentId: string;
  pollingInterval?: number;
}

export interface RunningMatchesState {
  runningMatchIds: Set<string>;
}

/**
 * Hook to poll for running matches from localStorage
 *
 * @param options - Tournament ID and optional polling interval
 * @returns Set of currently running match IDs
 */
export function useRunningMatches({
  tournamentId,
  pollingInterval = 2000,
}: UseRunningMatchesOptions): RunningMatchesState {
  const [runningMatchIds, setRunningMatchIds] = useState<Set<string>>(() =>
    getRunningMatchIds(tournamentId)
  );

  useEffect(() => {
    const updateRunningMatches = () => {
      const newIds = getRunningMatchIds(tournamentId);
      setRunningMatchIds(prev => {
        // Only update if the sets are different
        const prevArray = Array.from(prev).sort();
        const newArray = Array.from(newIds).sort();
        if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
          return newIds;
        }
        return prev;
      });
    };

    // Initial update
    updateRunningMatches();

    // Poll at specified interval
    const interval = setInterval(updateRunningMatches, pollingInterval);

    // Also listen for storage events (when changed in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.liveMatches(tournamentId)) {
        updateRunningMatches();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [tournamentId, pollingInterval]);

  return { runningMatchIds };
}
