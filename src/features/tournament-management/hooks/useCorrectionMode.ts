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
import { Tournament, CorrectionEntry, Match } from '../../../types/tournament';
import { MatchUpdate } from '../../../core/models/types';
import { diffMatchResultStatusUpdates } from '../../../core/services';
import { CorrectionReason } from '../../../types/userProfile';

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

interface UseCorrectionModeOptions {
  tournament: Tournament;
  /**
   * A2 Fixrunde 1 (Ruling AJ, C1: `.superpowers/sdd/2026-09-25-oktober-fundament-helfer/
   * task-A2-review.md`): applies the corrected tournament to LOCAL state only, WITHOUT a full
   * `save()` -- the score itself now persists via `onMatchesUpdate` (targeted update), same
   * pattern as `useScheduleTabActions#handleScoreChange`.
   */
  onLocalTournamentUpdate: (tournament: Tournament) => void;
  /** A2 Fixrunde 1: persists the corrected match's result via a targeted update instead of a
   *  full tournament save -- a full save skips result columns for existing matches (A2). */
  onMatchesUpdate: (updates: MatchUpdate[]) => void;
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
  onLocalTournamentUpdate,
  onMatchesUpdate,
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
      reasonType: reason,
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

    const updatedTournament = { ...tournament, matches: updatedMatches, updatedAt: new Date().toISOString() };

    // A2 Fixrunde 1 (C1): sync local state (standings recalculation etc.), then persist ONLY the
    // corrected match's result via a targeted update -- a full save() would skip it (A2).
    onLocalTournamentUpdate(updatedTournament);
    onMatchesUpdate(diffMatchResultStatusUpdates(tournament.matches, updatedMatches));

    setShowCorrectionDialog(false);
    setCorrectionState(null);
  }, [correctionState, tournament, onLocalTournamentUpdate, onMatchesUpdate, profile.name]);

  return {
    correctionState,
    showCorrectionDialog,
    handleStartCorrection,
    handleCancelCorrection,
    handleConfirmCorrection,
  };
}
