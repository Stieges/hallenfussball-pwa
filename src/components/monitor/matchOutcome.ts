/**
 * Sieger und Verlierer der Live-Anzeige: eine Regel für die bisherige Folie (`LiveScoreGrid`) und das Profil „Halle (sehr fern)“ (`HallMatchDisplay`).
 * Nur nach dem Abpfiff und mit Entscheidung; ein Unentschieden in der Gruppe hat weder Ring noch Pokal; im Kindermodus (`hideScore`) nie.
 */
import type { FinalScore } from '../../core/view';
import type { ScoreBoxOutcome } from '../ui/molecules/scoreBoxStyle';

export type MatchSide = 'a' | 'b';

/** Gewinnerseite, sonst `null` */
export function winnerOf(status: string, hideScore: boolean, finalScore: FinalScore | undefined): MatchSide | null {
  return !hideScore && status === 'FINISHED' ? finalScore?.winner ?? null : null;
}

export function outcomeOfSide(winner: MatchSide | null, side: MatchSide): ScoreBoxOutcome | undefined {
  return winner === null ? undefined : winner === side ? 'winner' : 'loser';
}
