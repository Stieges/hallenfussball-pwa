/**
 * useCorrectionMode - Zustand und Start/Abbruch des Korrektur-Dialogs
 *
 * A-08e (Frage 1 = A): Die Bestaetigung, die Spielstaende direkt schrieb (@FU-084), ist entfernt.
 * Der Hook wird im Spielplan derzeit nicht verdrahtet; B-24 baut den Ereignisweg in diese Datei.
 */

import { useState, useCallback } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { Tournament } from '../../../types/tournament';

// Correction state interface
interface CorrectionState {
  matchId: string;
  originalScoreA: number;
  originalScoreB: number;
}

interface UseCorrectionModeOptions {
  tournament: Tournament;
  canCorrectResults: boolean;
}

export interface CorrectionModeControls {
  correctionState: CorrectionState | null;
  showCorrectionDialog: boolean;
  handleStartCorrection: (matchId: string) => void;
  handleCancelCorrection: () => void;
}

/**
 * Hook to manage correction mode for finished matches
 *
 * @param options - Tournament data and callbacks
 * @returns Correction state and handlers
 */
export function useCorrectionMode({
  tournament,
  canCorrectResults,
}: UseCorrectionModeOptions): CorrectionModeControls {
  const { showWarning } = useToast();

  const [correctionState, setCorrectionState] = useState<CorrectionState | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  const handleStartCorrection = useCallback((matchId: string) => {
    // Check permission first - if not allowed, show warning
    if (!canCorrectResults) {
      showWarning('Du hast keine Berechtigung, Ergebnisse nachträglich zu korrigieren.');
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

  return {
    correctionState,
    showCorrectionDialog,
    handleStartCorrection,
    handleCancelCorrection,
  };
}
