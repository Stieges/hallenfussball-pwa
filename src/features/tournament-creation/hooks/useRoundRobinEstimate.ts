/**
 * Spielzahl und Ende bei „Jeder gegen jeden“ (@TM-153), einmal je Schritt und nur bei Änderung eines Feldes, das den
 * Spielplan bestimmt (Review #423 N1: die Schätzung erzeugt den ganzen Plan). Null bei „Gruppen + Finalrunde“.
 */
import { useMemo } from 'react';
import type { Tournament } from '../../../types/tournament';
import { estimateRoundRobinRounds, type RoundCountEstimate } from '../utils/roundCountEstimate';

export function useRoundRobinEstimate(formData: Partial<Tournament>): RoundCountEstimate | null {
  const {
    numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
    groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode,
  } = formData;
  return useMemo(() => ((groupSystem ?? 'roundRobin') === 'roundRobin'
    ? estimateRoundRobinRounds({
      numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
      groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode,
    })
    : null), [numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
    groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode]);
}
