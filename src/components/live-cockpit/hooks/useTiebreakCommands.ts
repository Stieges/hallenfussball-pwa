import { useCallback, useEffect, useState } from 'react';
import type { LiveCockpitProps, LiveMatch } from '../types';

type TiebreakProps = Pick<
  LiveCockpitProps,
  'onStartOvertime' | 'onStartGoldenGoal' | 'onStartPenaltyShootout' | 'onRecordPenaltyResult' | 'onForceFinish' | 'onAbortPenaltyShootout'
>;

export interface UseTiebreakCommandsReturn {
  /** Ist das Strafstoßschießen geöffnet (Zustand aus der Spielphase und dem eigenen Öffnen). */
  showPenaltyDialog: boolean;
  startOvertime: () => void;
  startGoldenGoal: () => void;
  startPenaltyShootout: () => void;
  endAsDraw: () => void;
  finishPenaltyShootout: (homeScore: number, awayScore: number) => void;
  cancelPenaltyShootout: () => void;
}

/** L1: Entscheidung nach Gleichstand (Verlängerung, Golden Goal, Strafstoßschießen), aus `LiveCockpit.tsx` ausgelagert. */
export function useTiebreakCommands(match: LiveMatch | null, props: TiebreakProps): UseTiebreakCommandsReturn {
  const { onStartOvertime, onStartGoldenGoal, onStartPenaltyShootout, onRecordPenaltyResult, onForceFinish, onAbortPenaltyShootout } = props;
  // L1: Strafstoßschießen-Dialog (Task 11)
  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);

  const startOvertime = useCallback(() => { if (match) { onStartOvertime?.(match.id); } }, [match, onStartOvertime]);
  const startGoldenGoal = useCallback(() => { if (match) { onStartGoldenGoal?.(match.id); } }, [match, onStartGoldenGoal]);
  const startPenaltyShootout = useCallback(() => {
    if (!match) { return; }
    onStartPenaltyShootout?.(match.id);
    setShowPenaltyDialog(true);
  }, [match, onStartPenaltyShootout]);
  // "Als Unentschieden beenden": MatchExecutionService.cancelTiebreaker persistiert als regulären Ausgang.
  const endAsDraw = useCallback(() => { if (match) { onForceFinish?.(match.id); } }, [match, onForceFinish]);

  // Der Dialog verwaltet seine Schussliste selbst, wir brauchen nur das Endergebnis
  // (MatchExecutionService.recordPenaltyResult schreibt penaltyScoreA/B, decidedBy='penalty').
  const finishPenaltyShootout = useCallback((homeScore: number, awayScore: number) => {
    if (!match) { return; }
    onRecordPenaltyResult?.(match.id, homeScore, awayScore);
    setShowPenaltyDialog(false);
  }, [match, onRecordPenaltyResult]);
  // Fixwave-Fix (Critical): "Abbrechen" bricht das Strafstoßschießen ab und zeigt wieder das
  // Tiebreaker-Banner – bewusst NICHT onCancelTiebreaker (das beendet das Spiel als Unentschieden,
  // das ist dem separaten "Als Unentschieden beenden"-Knopf vorbehalten, siehe endAsDraw).
  const cancelPenaltyShootout = useCallback(() => {
    if (!match) { return; }
    setShowPenaltyDialog(false);
    onAbortPenaltyShootout?.(match.id);
  }, [match, onAbortPenaltyShootout]);

  // L1: Dialog an die persistierte Phase koppeln (matches.live_state.playPhase über Realtime) – der Zustand kann
  // von einem anderen Gerät kommen. Fixwave-Fix (Critical): zusätzlich awaitingTiebreakerChoice prüfen –
  // abortPenaltyShootout setzt dieses Flag, um den Dialog zu schließen, OHNE playPhase zu ändern.
  useEffect(() => {
    setShowPenaltyDialog(
      match?.playPhase === 'penalty' && match.status !== 'FINISHED' && !match.awaitingTiebreakerChoice,
    );
  }, [match?.playPhase, match?.status, match?.awaitingTiebreakerChoice]);

  return { showPenaltyDialog, startOvertime, startGoldenGoal, startPenaltyShootout, endAsDraw, finishPenaltyShootout, cancelPenaltyShootout };
}
