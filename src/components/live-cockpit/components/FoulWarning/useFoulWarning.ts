/**
 * Hook to manage foul warning state
 *
 * Shows warning when a team reaches the foul threshold (default 5).
 * According to futsal rules, from the 6th foul onwards, the opposing team
 * gets a direct free kick from 10m without wall.
 */

import { useState, useCallback } from 'react';

export function useFoulWarning(threshold = 5) {
  const [warningTeam, setWarningTeam] = useState<{
    name: string;
    count: number;
  } | null>(null);
  const [shownTeams, setShownTeams] = useState<Set<string>>(new Set());

  const checkFouls = useCallback((teamId: string, teamName: string, foulCount: number) => {
    // Show warning when threshold is reached, but only once per team
    if (foulCount >= threshold && !shownTeams.has(teamId)) {
      setWarningTeam({ name: teamName, count: foulCount });
      setShownTeams(prev => new Set(prev).add(teamId));
    }
  }, [threshold, shownTeams]);

  const dismissWarning = useCallback(() => {
    setWarningTeam(null);
  }, []);

  const resetWarnings = useCallback(() => {
    setWarningTeam(null);
    setShownTeams(new Set());
  }, []);

  return {
    warningTeam,
    checkFouls,
    dismissWarning,
    resetWarnings,
    isWarningVisible: warningTeam !== null,
  };
}
