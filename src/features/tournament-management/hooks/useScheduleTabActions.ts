/**
 * useScheduleTabActions - Ergebnis-Eingabe im Spielplan (Schnelleingabe).
 *
 * Tauschen, Schiedsrichter, Feld und Neuverteilen stehen seit G1a in `useScheduleEditActions` (Entwurf, @ZP-101).
 */

import { useCallback } from 'react';
import { Tournament } from '../../../types/tournament';
import { useScheduleResultEntry, type ScheduleResultEntry } from './useScheduleResultEntry';

interface UseScheduleTabActionsProps {
  tournament: Tournament;
  showWarning: (message: string) => void;
  lockFinishedResults: boolean;
  /** B-49 (@FU-081): fremd gesteuertes Feld bei laufendem Spiel – Hinweis bzw. „Spielleitung übernehmen“. */
  offerTakeover?: (matchId: string, field: number | null) => Promise<boolean>;
}

interface UseScheduleTabActionsResult {
  handleScoreChange: (matchId: string, scoreA: number, scoreB: number) => Promise<boolean>;
  /** A-08f3e2: Rückfrage (Grund bzw. abgesetzt) der Schnelleingabe -- ScheduleTab zeigt sie an. */
  resultEntry: Pick<ScheduleResultEntry, 'prompt' | 'answerPrompt' | 'changeAuthor'>;
}

export function useScheduleTabActions({
  tournament,
  showWarning,
  lockFinishedResults,
  offerTakeover,
}: UseScheduleTabActionsProps): UseScheduleTabActionsResult {
  // A-08f3e2: die Schnelleingabe schreibt nur noch Server-Einträge (useScheduleResultEntry), nie den Spielstand selbst.
  const resultEntry = useScheduleResultEntry({ tournament, showWarning, lockFinishedResults, offerTakeover });
  const { enterScore } = resultEntry;
  const handleScoreChange = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    return enterScore(matchId, scoreA, scoreB);
  }, [enterScore]);

  return {
    handleScoreChange,
    resultEntry: { prompt: resultEntry.prompt, answerPrompt: resultEntry.answerPrompt, changeAuthor: resultEntry.changeAuthor },
  };
}
