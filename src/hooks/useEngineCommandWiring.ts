/**
 * useEngineCommandWiring (C3a-2a, W11; A-08d2b: ohne Altweg): schreibt die Cockpit-Befehle ausschliesslich
 * ueber `MatchCommands`. Es gibt keinen Alt-Handler mehr: eine Aktion ohne Engine-Weg (kein Engine-Spiel,
 * fehlende lokale Kopie, Minus-Tor, Abwesenheit des Kontexts) wird mit einem Hinweis abgelehnt
 * (@FU-071 "abgelehnt mit Grund", kein stiller Ausfall).
 *
 * W6: kein Handler wirft in die UI. `MatchCommandRejectedError` (lokale Vorpruefung) und
 * `LocalStoreFullError` (Speicher voll) werden hier gefangen und als Toast gezeigt -- betrifft auch
 * Fire-and-forget-Aufrufer (`ManagementTab.tsx`: `void handleDeleteEvent(...)`).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { MatchCommands, MatchCommandRejectedError, type CommandResult } from '../core/match/client';
import type { MatchContext } from '../core/match';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { useToast } from '../components/ui/Toast/ToastContext';
import { captureFeatureError } from '../lib/sentry';
import { useActorRole } from './useActorRole';
import { serverRulesFor } from './engineServerRules';
import { buildValidMatches } from './useEngineMatches';
import { mapCardTypeToEngine, type EngineCommandHandlers, type GoalHandlerOptions } from './engineCommandWiringTypes';
import { rejectionMessageKey } from './engineCommandWiringHelpers';
import { defaultKit, type MatchKit } from '../core/models/kit';
import { kitAusWahl, trikotFarben, type LeibchenWahl } from '../core/models/kitChoice';
import type { Match } from '../types/tournament';

/** Das `kit` des Anpfiffs: die Wahl der Anpfiff-Ansicht (@SL-137, @SL-149), ohne Wahl die Vorbelegung (`defaultKit`). */
function kitBeimAnpfiff(match: Match, tournament: Tournament, leibchen: LeibchenWahl | undefined): MatchKit {
  return leibchen ? kitAusWahl(trikotFarben(match, tournament.teams), leibchen) : defaultKit(match, tournament.teams, tournament);
}

export type { EngineCommandHandlers } from './engineCommandWiringTypes';

export function useEngineCommandWiring(
  tournament: Tournament,
  matchEngineContext: MatchEngineContextValue | null,
  engineLiveMatches: Map<string, LiveMatch>,
  // P3: engine-bestimmt, aber (noch) keine Engine-Ansicht -- Defaults halten bestehende
  // Aufrufer/Tests unveraendert, die dieses Fenster nicht pruefen.
  isEngineDestinedMatchId: (matchId: string) => boolean = () => false,
  ensureEngineMatchReady: (matchId: string) => Promise<LiveMatch | null> = () => Promise.resolve(null),
): EngineCommandHandlers {
  const { t } = useTranslation('cockpit');
  const { showWarning, showError } = useToast();
  const actor = useActorRole(tournament.id);
  const penaltyEndsOnGoal = tournament.matchCockpitSettings?.penaltyEndsOnGoal ?? DEFAULT_MATCH_COCKPIT_SETTINGS.penaltyEndsOnGoal;

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
      // A-08b: der Grund bestimmt den Text (`rejectionMessageKey`); Ablehnungen sind Warnungen.
      const message = t(rejectionMessageKey(error));
      if (error instanceof MatchCommandRejectedError) {
        showWarning(message);
      } else {
        showError(message);
      }
    },
    [showWarning, showError, t],
  );

  const isEngineMatch = useCallback((matchId: string) => engineLiveMatches.has(matchId), [engineLiveMatches]);

  /** A-08d2b (@FU-071): ohne Engine-Weg wird nichts ausgefuehrt, nur der Hinweis gezeigt. */
  const reject = useCallback(async (): Promise<void> => {
    showWarning(t('engine.invalid'));
  }, [showWarning, t]);

  /** B-07: liefert das Ergebnis des Befehls (Ereignis-ID), `null` bei gefangenem Fehler. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        handleEngineError(error);
        return null;
      }
    },
    [handleEngineError],
  );

  /** Ruft `commands.start` fuer ein Spiel auf, dessen lokale Engine-Kopie bereits existiert
   * (Vorbedingung von `MatchCommands.submit`, sonst "keine lokale Kopie"-Wurf). */
  const startViaCommands = useCallback(
    async (matchId: string, leibchen?: LeibchenWahl): Promise<boolean> => {
      if (!commands) {
        return false;
      }
      const ctx = ctxByExternalId.get(matchId);
      if (!ctx) {
        return false;
      }
      try {
        const match = tournament.matches.find((m) => m.id === matchId);
        // A-30a (F1): kit geht bei jedem Anpfiff mit – die Wahl der Anpfiff-Ansicht (@SL-137, @SL-149), ohne sie die Vorbelegung
        await commands.start(matchId, ctx, actor, serverRulesFor(tournament, match), match && kitBeimAnpfiff(match, tournament, leibchen));
        return true;
      } catch (error) {
        handleEngineError(error);
        return false;
      }
    },
    [commands, ctxByExternalId, actor, tournament, handleEngineError],
  );

  const handleStart = useCallback(
    async (matchId: string, leibchen?: LeibchenWahl): Promise<boolean> => {
      if (isEngineMatch(matchId) && commands) {
        return startViaCommands(matchId, leibchen);
      }
      // P3: engine-bestimmt, aber noch KEINE Engine-Ansicht -- ERST `ensureEngineMatchReady`, DANN
      // `commands.start`. Kein Engine-Weg (kein Engine-Spiel, `null` von `ensureEngineMatchReady`):
      // ruhige Ablehnung mit Hinweis (kein Sentry), kein Anpfiff. Eine Ablehnung von `ensureEngineMatchReady` (z. B.
      // E1: Server-Klaerung gescheitert) wird gemeldet (Toast + Sentry, P7-Weg).
      if (!commands || !isEngineDestinedMatchId(matchId)) {
        await reject();
        return false;
      }
      try {
        const ready = await ensureEngineMatchReady(matchId);
        if (ready) {
          return startViaCommands(matchId, leibchen);
        }
        // W1: `null` ist ein erwartbarer Fall (kein Engine-Spiel / Server noch ohne Ereignisse), kein Fehler.
        await reject();
        return false;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        captureFeatureError(normalizedError, 'tournament', 'ensureEngineMatchReady');
        handleEngineError(normalizedError);
        return false;
      }
    },
    [isEngineMatch, commands, isEngineDestinedMatchId, ensureEngineMatchReady, startViaCommands, handleEngineError, reject],
  );

  // W11 (Fixrunde 4): die uebrigen Handler teilen sich dieselbe Form (Engine-Wache, `ctx`-Nachschlag,
  // `run`). Ohne Engine-Weg: Ablehnung statt Ausfuehrung (A-08d2b).
  const runSimpleCommand = useCallback(
    async (matchId: string, commandFn: (cmd: MatchCommands, ctx: MatchContext) => CommandResult): Promise<string | null> => {
      const ctx = isEngineMatch(matchId) && commands ? ctxByExternalId.get(matchId) : undefined;
      if (!commands || !ctx) {
        await reject();
        return null;
      }
      return run(() => commandFn(commands, ctx));
    },
    [isEngineMatch, commands, ctxByExternalId, run, reject],
  );

  const handlePause = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.pause(matchId, ctx, actor)),
    [runSimpleCommand, actor],
  );

  const handleResume = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.resume(matchId, ctx, actor)),
    [runSimpleCommand, actor],
  );

  const handleFinish = useCallback(
    (matchId: string) => runSimpleCommand(matchId, (cmd, ctx) => cmd.finish(matchId, ctx, actor)),
    [runSimpleCommand, actor],
  );

  const handleGoal = useCallback(
    async (matchId: string, teamId: string, delta: 1 | -1, options?: GoalHandlerOptions): Promise<string | null> => {
      // PC14: nur +1 -- Minus/Rueckgaengig ist RETRACT (C3b, `useEngineEventEditing`).
      if (delta !== 1) {
        await reject();
        return null;
      }
      // L2 (@SL-022): `own` waehlt OWN_GOAL; `teamId` ist dann das Team, das das Eigentor schoss.
      const { own = false, ...goalOptions } = options ?? {};
      return runSimpleCommand(matchId, (cmd, ctx) => cmd.goal(matchId, ctx, actor, teamId.toLowerCase(), own, goalOptions));
    },
    [actor, runSimpleCommand, reject],
  );

  const handleCard = useCallback(
    (matchId: string, teamId: string, cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', options?: { playerNumber?: number; clockMs?: number; section?: number }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.card(matchId, ctx, actor, teamId.toLowerCase(), mapCardTypeToEngine(cardType), options),
      ),
    [runSimpleCommand, actor],
  );

  const handleTimePenalty = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number; durationSeconds?: number; clockMs?: number; section?: number }) =>
      // @W2A-013: die Regel „endet bei Gegentor“ gilt ab dem Eintrag der Strafe und steht im Eintrag
      runSimpleCommand(matchId, (cmd, ctx) => cmd.timePenalty(matchId, ctx, actor, teamId.toLowerCase(), { ...options, endsOnGoal: penaltyEndsOnGoal })),
    [runSimpleCommand, actor, penaltyEndsOnGoal],
  );

  const handleSubstitution = useCallback(
    (matchId: string, teamId: string, options?: { playersIn?: number[]; playersOut?: number[] }) =>
      runSimpleCommand(matchId, (cmd, ctx) => cmd.substitution(matchId, ctx, actor, teamId.toLowerCase(), options)),
    [runSimpleCommand, actor],
  );

  const handleFoul = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number }) =>
      runSimpleCommand(matchId, (cmd, ctx) => cmd.foul(matchId, ctx, actor, teamId.toLowerCase(), options)),
    [runSimpleCommand, actor],
  );

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
  };
}
