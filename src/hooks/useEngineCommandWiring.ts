/**
 * useEngineCommandWiring (C3a-2a, W11 -- eigene Datei, `useMatchExecution.ts` waechst nicht):
 * schaltet die PC14-Schreib-Handler von `useMatchExecution` fuer Engine-Spiele auf
 * `MatchCommands` um. Fuer Altspiele (kein Eintrag in `engineLiveMatches`) laeuft der jeweils
 * uebergebene Alt-Handler unveraendert weiter (B4: `liveMatchRepository.save` bleibt dort erlaubt).
 *
 * W6: kein Handler wirft in die UI. `MatchCommandRejectedError` (lokale Vorpruefung),
 * `LocalStoreFullError` (Speicher voll) und `NotOnEngineYetError` (Aktion noch nicht umgestellt,
 * PC14) werden hier gefangen und als Toast gezeigt -- betrifft auch Fire-and-forget-Aufrufer
 * (`ManagementTab.tsx`: `void handleDeleteEvent(...)`, `LiveCockpit`/`LiveCockpitMockup`).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import {
  MatchCommands,
  MatchCommandRejectedError,
  LocalStoreFullError,
  NotOnEngineYetError,
} from '../core/match/client';
import { serverRules, type MatchContext, type MatchRules } from '../core/match';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { useToast } from '../components/ui/Toast/ToastContext';
import { useActorRole } from './useActorRole';
import { buildValidMatches } from './useEngineMatches';

export interface EngineCommandFallbackHandlers {
  handleStart: (matchId: string) => Promise<boolean>;
  handlePause: (matchId: string) => Promise<void>;
  handleResume: (matchId: string) => Promise<void>;
  handleFinish: (matchId: string) => Promise<void>;
  handleForceFinish: (matchId: string) => Promise<void>;
  handleGoal: (
    matchId: string,
    teamId: string,
    delta: 1 | -1,
    options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean },
  ) => Promise<void>;
  handleCard: (
    matchId: string,
    teamId: string,
    cardType: 'YELLOW' | 'RED',
    options?: { playerNumber?: number },
  ) => Promise<void>;
  handleTimePenalty: (
    matchId: string,
    teamId: string,
    options?: { playerNumber?: number; durationSeconds?: number },
  ) => Promise<void>;
  handleSubstitution: (
    matchId: string,
    teamId: string,
    options?: { playersIn?: number[]; playersOut?: number[] },
  ) => Promise<void>;
  handleFoul: (matchId: string, teamId: string, options?: { playerNumber?: number }) => Promise<void>;
  handleStartOvertime: (matchId: string) => Promise<void>;
  handleStartGoldenGoal: (matchId: string) => Promise<void>;
  handleStartPenaltyShootout: (matchId: string) => Promise<void>;
  handleRecordPenaltyResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  handleCancelTiebreaker: (matchId: string) => Promise<void>;
  handleAbortPenaltyShootout: (matchId: string) => Promise<void>;
  handleManualEditResult: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  handleAdjustTime: (matchId: string, newElapsedSeconds: number) => Promise<void>;
  handleSkipMatch: (matchId: string, reason: string) => Promise<void>;
  handleUnskipMatch: (matchId: string) => Promise<void>;
  handleUndoLastEvent: (matchId: string) => Promise<void>;
  handleUpdateEvent: (
    matchId: string,
    eventId: string,
    updates: { playerNumber?: number; incomplete?: boolean },
  ) => Promise<void>;
  handleDeleteEvent: (matchId: string, eventId: string) => Promise<void>;
}

function serverRulesFor(tournament: Tournament, matchId: string): MatchRules {
  const match = tournament.matches.find((m) => m.id === matchId);
  return serverRules({
    durationMinutes: null,
    phase: match?.phase ?? null,
    groupPhaseDuration: tournament.groupPhaseGameDuration,
    finalRoundDuration: tournament.finalRoundGameDuration ?? null,
    config: {
      gamePeriods: tournament.gamePeriods,
      halftimeBreak: tournament.halftimeBreak,
      matchCockpitSettings: tournament.matchCockpitSettings,
    },
    finalsConfig: tournament.finalsConfig ?? null,
  });
}

export function useEngineCommandWiring(
  tournament: Tournament,
  matchEngineContext: MatchEngineContextValue | null,
  engineLiveMatches: Map<string, LiveMatch>,
  fallback: EngineCommandFallbackHandlers,
): EngineCommandFallbackHandlers {
  const { t } = useTranslation('cockpit');
  const { showWarning, showError } = useToast();
  const actor = useActorRole(tournament.id);

  const ctxByExternalId = useMemo(() => {
    const map = new Map<string, MatchContext>();
    for (const entry of buildValidMatches(tournament)) {
      map.set(entry.externalId, entry.ctx);
    }
    return map;
  }, [tournament]);

  const commands = useMemo(() => {
    if (!matchEngineContext) {
      return null;
    }
    return new MatchCommands({
      engine: matchEngineContext.engine,
      store: matchEngineContext.store,
      sender: matchEngineContext.sender,
      accountId: matchEngineContext.accountId,
    });
  }, [matchEngineContext]);

  /** W6: faengt die typisierten Fehler, zeigt einen Toast, wirft NICHT in die UI. */
  const handleEngineError = useCallback(
    (error: unknown) => {
      if (error instanceof NotOnEngineYetError) {
        showWarning(t('engine.notYet'));
      } else if (error instanceof LocalStoreFullError) {
        showError(t('engine.storeFull'));
      } else if (error instanceof MatchCommandRejectedError) {
        showWarning(t('engine.invalid'));
      } else {
        showError(t('engine.invalid'));
      }
    },
    [showWarning, showError, t],
  );

  const isEngineMatch = useCallback((matchId: string) => engineLiveMatches.has(matchId), [engineLiveMatches]);

  const notYet = useCallback(async (): Promise<void> => {
    handleEngineError(new NotOnEngineYetError());
  }, [handleEngineError]);

  /** PC14: fuer Engine-Spiele der `NotOnEngineYetError`-Toast statt Ausfuehrung; Altspiele
   * bleiben unveraendert. */
  const guarded = useCallback(
    async <A extends unknown[], R>(matchId: string, fn: (...a: A) => Promise<R>, ...args: A): Promise<R | undefined> => {
      if (isEngineMatch(matchId)) {
        await notYet();
        return undefined;
      }
      return fn(...args);
    },
    [isEngineMatch, notYet],
  );

  const run = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      try {
        await fn();
      } catch (error) {
        handleEngineError(error);
      }
    },
    [handleEngineError],
  );

  const handleStart = useCallback(
    async (matchId: string): Promise<boolean> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleStart(matchId);
      }
      const ctx = ctxByExternalId.get(matchId);
      if (!ctx) {
        return fallback.handleStart(matchId);
      }
      try {
        await commands.start(matchId, ctx, actor, serverRulesFor(tournament, matchId));
        return true;
      } catch (error) {
        handleEngineError(error);
        return false;
      }
    },
    [isEngineMatch, commands, ctxByExternalId, actor, tournament, fallback, handleEngineError],
  );

  const handlePause = useCallback(
    (matchId: string): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handlePause(matchId);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx ? run(() => commands.pause(matchId, ctx, actor)) : fallback.handlePause(matchId);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleResume = useCallback(
    (matchId: string): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleResume(matchId);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx ? run(() => commands.resume(matchId, ctx, actor)) : fallback.handleResume(matchId);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleFinish = useCallback(
    (matchId: string): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleFinish(matchId);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx ? run(() => commands.finish(matchId, ctx, actor)) : fallback.handleFinish(matchId);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleGoal = useCallback(
    (
      matchId: string,
      teamId: string,
      delta: 1 | -1,
      options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean },
    ): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleGoal(matchId, teamId, delta, options);
      }
      // PC14: nur +1 -- Minus/Rueckgaengig ist RETRACT (C3b).
      if (delta !== 1) {
        return notYet();
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx
        ? run(() => commands.goal(matchId, ctx, actor, teamId.toLowerCase(), false, options))
        : fallback.handleGoal(matchId, teamId, delta, options);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run, notYet],
  );

  const handleCard = useCallback(
    (matchId: string, teamId: string, cardType: 'YELLOW' | 'RED', options?: { playerNumber?: number }): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleCard(matchId, teamId, cardType, options);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx
        ? run(() => commands.card(matchId, ctx, actor, teamId.toLowerCase(), cardType === 'YELLOW' ? 'YELLOW_CARD' : 'RED_CARD', options))
        : fallback.handleCard(matchId, teamId, cardType, options);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleTimePenalty = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number; durationSeconds?: number }): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleTimePenalty(matchId, teamId, options);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx
        ? run(() => commands.timePenalty(matchId, ctx, actor, teamId.toLowerCase(), options))
        : fallback.handleTimePenalty(matchId, teamId, options);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleSubstitution = useCallback(
    (matchId: string, teamId: string, options?: { playersIn?: number[]; playersOut?: number[] }): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleSubstitution(matchId, teamId, options);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx
        ? run(() => commands.substitution(matchId, ctx, actor, teamId.toLowerCase(), options))
        : fallback.handleSubstitution(matchId, teamId, options);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleFoul = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number }): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallback.handleFoul(matchId, teamId, options);
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx
        ? run(() => commands.foul(matchId, ctx, actor, teamId.toLowerCase(), options))
        : fallback.handleFoul(matchId, teamId, options);
    },
    [isEngineMatch, commands, ctxByExternalId, actor, fallback, run],
  );

  const handleForceFinish = useCallback((matchId: string) => guarded(matchId, fallback.handleForceFinish, matchId), [guarded, fallback]);
  const handleStartOvertime = useCallback((matchId: string) => guarded(matchId, fallback.handleStartOvertime, matchId), [guarded, fallback]);
  const handleStartGoldenGoal = useCallback((matchId: string) => guarded(matchId, fallback.handleStartGoldenGoal, matchId), [guarded, fallback]);
  const handleStartPenaltyShootout = useCallback((matchId: string) => guarded(matchId, fallback.handleStartPenaltyShootout, matchId), [guarded, fallback]);
  const handleRecordPenaltyResult = useCallback(
    (matchId: string, homeScore: number, awayScore: number) => guarded(matchId, fallback.handleRecordPenaltyResult, matchId, homeScore, awayScore),
    [guarded, fallback],
  );
  const handleCancelTiebreaker = useCallback((matchId: string) => guarded(matchId, fallback.handleCancelTiebreaker, matchId), [guarded, fallback]);
  const handleAbortPenaltyShootout = useCallback((matchId: string) => guarded(matchId, fallback.handleAbortPenaltyShootout, matchId), [guarded, fallback]);
  const handleManualEditResult = useCallback(
    (matchId: string, homeScore: number, awayScore: number) => guarded(matchId, fallback.handleManualEditResult, matchId, homeScore, awayScore),
    [guarded, fallback],
  );
  const handleAdjustTime = useCallback((matchId: string, newElapsedSeconds: number) => guarded(matchId, fallback.handleAdjustTime, matchId, newElapsedSeconds), [guarded, fallback]);
  const handleSkipMatch = useCallback((matchId: string, reason: string) => guarded(matchId, fallback.handleSkipMatch, matchId, reason), [guarded, fallback]);
  const handleUnskipMatch = useCallback((matchId: string) => guarded(matchId, fallback.handleUnskipMatch, matchId), [guarded, fallback]);
  const handleUndoLastEvent = useCallback((matchId: string) => guarded(matchId, fallback.handleUndoLastEvent, matchId), [guarded, fallback]);
  const handleUpdateEvent = useCallback(
    (matchId: string, eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) =>
      guarded(matchId, fallback.handleUpdateEvent, matchId, eventId, updates),
    [guarded, fallback],
  );
  const handleDeleteEvent = useCallback(
    (matchId: string, eventId: string) => guarded(matchId, fallback.handleDeleteEvent, matchId, eventId),
    [guarded, fallback],
  );

  return {
    handleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleForceFinish,
    handleGoal,
    handleCard,
    handleTimePenalty,
    handleSubstitution,
    handleFoul,
    handleStartOvertime,
    handleStartGoldenGoal,
    handleStartPenaltyShootout,
    handleRecordPenaltyResult,
    handleCancelTiebreaker,
    handleAbortPenaltyShootout,
    handleManualEditResult,
    handleAdjustTime,
    handleSkipMatch,
    handleUnskipMatch,
    handleUndoLastEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
}
