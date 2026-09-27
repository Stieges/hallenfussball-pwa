/**
 * engineCommandWiringHelpers (C3a-2a Fixrunde 3, P8/E2/W11): die "guarded delegates" aus
 * `useEngineCommandWiring.ts` ausgelagert -- reine PC14-Toast-Wache (kein eigener MatchCommands-
 * Aufruf): fuer ein Engine-Spiel `NotOnEngineYetError` statt Ausfuehrung, fuer ein Altspiel der
 * unveraenderte Alt-Handler.
 */
import type { EngineCommandFallbackHandlers, GuardedDelegateHandlers } from './engineCommandWiringTypes';

/** Signatur von `guarded` in `useEngineCommandWiring.ts` (per-Spiel-Wache + Alt-Handler-Aufruf). */
export type Guarded = <A extends unknown[], R>(
  matchId: string,
  fn: (...a: A) => Promise<R>,
  ...args: A
) => Promise<R | undefined>;

export function createGuardedDelegates(
  guarded: Guarded,
  fallback: EngineCommandFallbackHandlers,
): GuardedDelegateHandlers {
  return {
    handleForceFinish: (matchId: string) => guarded(matchId, fallback.handleForceFinish, matchId),
    handleStartOvertime: (matchId: string) => guarded(matchId, fallback.handleStartOvertime, matchId),
    handleStartGoldenGoal: (matchId: string) => guarded(matchId, fallback.handleStartGoldenGoal, matchId),
    handleStartPenaltyShootout: (matchId: string) => guarded(matchId, fallback.handleStartPenaltyShootout, matchId),
    handleRecordPenaltyResult: (matchId: string, homeScore: number, awayScore: number) =>
      guarded(matchId, fallback.handleRecordPenaltyResult, matchId, homeScore, awayScore),
    handleCancelTiebreaker: (matchId: string) => guarded(matchId, fallback.handleCancelTiebreaker, matchId),
    handleAbortPenaltyShootout: (matchId: string) => guarded(matchId, fallback.handleAbortPenaltyShootout, matchId),
    handleManualEditResult: (matchId: string, homeScore: number, awayScore: number) =>
      guarded(matchId, fallback.handleManualEditResult, matchId, homeScore, awayScore),
    handleAdjustTime: (matchId: string, newElapsedSeconds: number) =>
      guarded(matchId, fallback.handleAdjustTime, matchId, newElapsedSeconds),
    handleSkipMatch: (matchId: string, reason: string) => guarded(matchId, fallback.handleSkipMatch, matchId, reason),
    handleUnskipMatch: (matchId: string) => guarded(matchId, fallback.handleUnskipMatch, matchId),
    handleUndoLastEvent: (matchId: string) => guarded(matchId, fallback.handleUndoLastEvent, matchId),
    handleUpdateEvent: (matchId: string, eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) =>
      guarded(matchId, fallback.handleUpdateEvent, matchId, eventId, updates),
    handleDeleteEvent: (matchId: string, eventId: string) => guarded(matchId, fallback.handleDeleteEvent, matchId, eventId),
  };
}
