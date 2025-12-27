/**
 * useCorrectionMode - Manages correction dialog state and flow
 *
 * Handles:
 * - Starting correction mode (with permission check)
 * - Canceling correction
 * - Confirming correction with history logging
 */

import { useState, useCallback } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { useUserProfile } from '../../../hooks/useUserProfile';
import { Tournament, CorrectionEntry, CorrectionReasonType, Match } from '../../../types/tournament';
import { CorrectionReason } from '../../../types/userProfile';

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

interface UseCorrectionModeOptions {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  canCorrectResults: boolean;
}

export interface CorrectionModeControls {
  correctionState: CorrectionState | null;
  showCorrectionDialog: boolean;
  handleStartCorrection: (matchId: string) => void;
  handleCancelCorrection: () => void;
  handleConfirmCorrection: (
    newScoreA: number,
    newScoreB: number,
    reason: CorrectionReason,
    note?: string
  ) => void;
}

/**
 * Hook to manage correction mode for finished matches
 *
 * @param options - Tournament data and callbacks
 * @returns Correction state and handlers
 */
export function useCorrectionMode({
  tournament,
  onTournamentUpdate,
  canCorrectResults,
}: UseCorrectionModeOptions): CorrectionModeControls {
  const { showWarning } = useToast();
  const { profile } = useUserProfile();

  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  const handleStartCorrection = useCallback((matchId: string) => {
    // Check permission first - if not allowed, show warning
    if (!canCorrectResults) {
      showWarning('Sie haben keine Berechtigung, Ergebnisse nachträglich zu korrigieren.');
      return;
    }

    const match = tournament.matches.find(m => m.id === matchId);
    if (match?.scoreA === undefined || match.scoreB === undefined) {
      return;
    }

    setCorrectionState({
      matchId,
      originalScoreA: match.scoreA,
      originalScoreB: match.scoreB,
    });
    setShowCorrectionDialog(true);
  }, [canCorrectResults, showWarning, tournament.matches]);

  const handleCancelCorrection = useCallback(() => {
    setShowCorrectionDialog(false);
    setCorrectionState(null);
  }, []);

  const handleConfirmCorrection = useCallback((
    newScoreA: number,
    newScoreB: number,
    reason: CorrectionReason,
    note?: string
  ) => {
    if (!correctionState) {
      return;
    }

    // Create correction entry for match history
    const correctionEntry: CorrectionEntry = {
      timestamp: new Date().toISOString(),
      previousScoreA: correctionState.originalScoreA,
      previousScoreB: correctionState.originalScoreB,
      newScoreA,
      newScoreB,
      reasonType: reason as CorrectionReasonType,
      note,
      userName: profile.name,
    };

    // Update tournament matches with correction history
    const updatedMatches: Match[] = tournament.matches.map(m => {
      if (m.id !== correctionState.matchId) {
        return m;
      }

      // Add correction to history
      const existingHistory = m.correctionHistory ?? [];
      return {
        ...m,
        scoreA: newScoreA,
        scoreB: newScoreB,
        correctionHistory: [...existingHistory, correctionEntry],
      };
    });

    onTournamentUpdate(
      { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() },
      false // Triggers standings recalculation in parent
    );

    setShowCorrectionDialog(false);
    setCorrectionState(null);
  }, [correctionState, tournament, onTournamentUpdate, profile.name]);

  return {
    correctionState,
    showCorrectionDialog,
    handleStartCorrection,
    handleCancelCorrection,
    handleConfirmCorrection,
  };
}
