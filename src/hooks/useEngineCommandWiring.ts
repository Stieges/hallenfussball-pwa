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
import { captureFeatureError } from '../lib/sentry';
import { useActorRole } from './useActorRole';
import { buildValidMatches } from './useEngineMatches';
import { mapCardTypeToEngine, type EngineCommandFallbackHandlers } from './engineCommandWiringTypes';
import { createGuardedDelegates } from './engineCommandWiringHelpers';

export type { EngineCommandFallbackHandlers } from './engineCommandWiringTypes';

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
  // P3: engine-bestimmt, aber (noch) keine Engine-Ansicht -- Defaults halten bestehende
  // Aufrufer/Tests unveraendert, die dieses Fenster nicht pruefen.
  isEngineDestinedMatchId: (matchId: string) => boolean = () => false,
  ensureEngineMatchReady: (matchId: string) => Promise<LiveMatch | null> = () => Promise.resolve(null),
  // P2 (E1-Randfall): "unklar"-Fall -- `null` von ensureEngineMatchReady heisst hier bestaetigtes
  // Altspiel, der Altweg ist wieder erlaubt (anders als beim klaren B1-Fall unten).
  isForeignCandidateMatchId: (matchId: string) => boolean = () => false,
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

  /** Ruft `commands.start` fuer ein Spiel auf, dessen lokale Engine-Kopie bereits existiert
   * (Vorbedingung von `MatchCommands.submit`, sonst "keine lokale Kopie"-Wurf). */
  const startViaCommands = useCallback(
    async (matchId: string): Promise<boolean> => {
      if (!commands) {
        return false;
      }
      const ctx = ctxByExternalId.get(matchId);
      if (!ctx) {
        return false;
      }
      try {
        await commands.start(matchId, ctx, actor, serverRulesFor(tournament, matchId));
        return true;
      } catch (error) {
        handleEngineError(error);
        return false;
      }
    },
    [commands, ctxByExternalId, actor, tournament, handleEngineError],
  );

  const handleStart = useCallback(
    async (matchId: string): Promise<boolean> => {
      if (isEngineMatch(matchId) && commands) {
        return startViaCommands(matchId);
      }
      // P3: engine-bestimmt, aber noch KEINE Engine-Ansicht -- ERST `ensureEngineMatchReady`, DANN
      // `commands.start`, kein Fallback (das Spiel IST/WIRD ein Engine-Spiel). `null`: P2-fremd ->
      // Altweg erlaubt; klarer B1-Fall -> Fehlerweg (Toast) statt stillem `false` (Minor 3).
      // E3 (Important 2): eine Ablehnung von `ensureEngineMatchReady` (z. B. E1: Server-Klaerung
      // gescheitert) war bisher unbehandelt (ueber `ManagementTab.tsx`) -- jetzt Toast + Sentry
      // (P7-Weg), kein Altweg-Anpfiff.
      if (commands && isEngineDestinedMatchId(matchId)) {
        try {
          const ready = await ensureEngineMatchReady(matchId);
          if (ready) {
            return startViaCommands(matchId);
          }
          if (isForeignCandidateMatchId(matchId)) {
            return fallback.handleStart(matchId);
          }
          throw new Error(`Engine-Spiel ${matchId} ist noch nicht bereit.`);
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          captureFeatureError(normalizedError, 'tournament', 'ensureEngineMatchReady');
          handleEngineError(normalizedError);
          return false;
        }
      }
      return fallback.handleStart(matchId);
    },
    [
      isEngineMatch, commands, isEngineDestinedMatchId, ensureEngineMatchReady, isForeignCandidateMatchId,
      startViaCommands, fallback, handleEngineError,
    ],
  );

  // W11 (Fixrunde 4): die uebrigen Handler teilen sich dieselbe Form (Engine-Wache,
  // `ctx`-Nachschlag, `run`, sonst Alt-Handler) -- ein gemeinsamer Helfer statt sieben fast
  // identischer Bloecke, um Platz fuer den E3-Fehlerweg oben zu schaffen (< 300 Zeilen).
  const runSimpleCommand = useCallback(
    (matchId: string, commandFn: (cmd: MatchCommands, ctx: MatchContext) => Promise<void>, fallbackFn: () => Promise<void>): Promise<void> => {
      if (!isEngineMatch(matchId) || !commands) {
        return fallbackFn();
      }
      const ctx = ctxByExternalId.get(matchId);
      return ctx ? run(() => commandFn(commands, ctx)) : fallbackFn();
    },
    [isEngineMatch, commands, ctxByExternalId, run],
  );

  const handlePause = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.pause(matchId, ctx, actor), () => fallback.handlePause(matchId)),
    [runSimpleCommand, actor, fallback],
  );

  const handleResume = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.resume(matchId, ctx, actor), () => fallback.handleResume(matchId)),
    [runSimpleCommand, actor, fallback],
  );

  const handleFinish = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.finish(matchId, ctx, actor), () => fallback.handleFinish(matchId)),
    [runSimpleCommand, actor, fallback],
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
      return runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.goal(matchId, ctx, actor, teamId.toLowerCase(), false, options),
        () => fallback.handleGoal(matchId, teamId, delta, options),
      );
    },
    [isEngineMatch, commands, actor, fallback, notYet, runSimpleCommand],
  );

  const handleCard = useCallback(
    (matchId: string, teamId: string, cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', options?: { playerNumber?: number }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.card(matchId, ctx, actor, teamId.toLowerCase(), mapCardTypeToEngine(cardType), options),
        () => fallback.handleCard(matchId, teamId, cardType, options),
      ),
    [runSimpleCommand, actor, fallback],
  );

  const handleTimePenalty = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number; durationSeconds?: number }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.timePenalty(matchId, ctx, actor, teamId.toLowerCase(), options),
        () => fallback.handleTimePenalty(matchId, teamId, options),
      ),
    [runSimpleCommand, actor, fallback],
  );

  const handleSubstitution = useCallback(
    (matchId: string, teamId: string, options?: { playersIn?: number[]; playersOut?: number[] }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.substitution(matchId, ctx, actor, teamId.toLowerCase(), options),
        () => fallback.handleSubstitution(matchId, teamId, options),
      ),
    [runSimpleCommand, actor, fallback],
  );

  const handleFoul = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.foul(matchId, ctx, actor, teamId.toLowerCase(), options),
        () => fallback.handleFoul(matchId, teamId, options),
      ),
    [runSimpleCommand, actor, fallback],
  );

  // P8 (Fixrunde 3, E2/W11): die reinen PC14-Toast-Wachen (kein eigener MatchCommands-Aufruf)
  // sitzen in `./engineCommandWiringHelpers` -- eigene Datei statt 14 fast identischer
  // `useCallback`-Zeilen hier.
  const guardedDelegates = useMemo(() => createGuardedDelegates(guarded, fallback), [guarded, fallback]);

  return {
    handleStart,
    handlePause,
    handleResume,
    handleFinish,
    handleGoal,
    handleCard,
    handleTimePenalty,
    handleSubstitution,
    handleFoul,
    ...guardedDelegates,
  };
}
