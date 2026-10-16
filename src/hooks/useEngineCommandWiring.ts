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
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { MatchCommands, MatchCommandRejectedError } from '../core/match/client';
import type { MatchContext } from '../core/match';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';
import { useToast } from '../components/ui/Toast/ToastContext';
import { captureFeatureError } from '../lib/sentry';
import { useActorRole } from './useActorRole';
import { serverRulesFor } from './engineServerRules';
import { buildValidMatches } from './useEngineMatches';
import { mapCardTypeToEngine, type EngineCommandHandlers } from './engineCommandWiringTypes';
import { rejectionMessageKey } from './engineCommandWiringHelpers';

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
        await commands.start(matchId, ctx, actor, serverRulesFor(tournament, tournament.matches.find((m) => m.id === matchId)));
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
          return startViaCommands(matchId);
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
    (matchId: string, commandFn: (cmd: MatchCommands, ctx: MatchContext) => Promise<void>): Promise<void> => {
      const ctx = isEngineMatch(matchId) && commands ? ctxByExternalId.get(matchId) : undefined;
      if (!commands || !ctx) {
        return reject();
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
    (
      matchId: string,
      teamId: string,
      delta: 1 | -1,
      options?: { playerNumber?: number; assists?: number[]; incomplete?: boolean },
    ): Promise<void> => {
      // PC14: nur +1 -- Minus/Rueckgaengig ist RETRACT (C3b, `useEngineEventEditing`).
      if (delta !== 1) {
        return reject();
      }
      return runSimpleCommand(matchId, (cmd, ctx) => cmd.goal(matchId, ctx, actor, teamId.toLowerCase(), false, options));
    },
    [actor, runSimpleCommand, reject],
  );

  const handleCard = useCallback(
    (matchId: string, teamId: string, cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', options?: { playerNumber?: number }) =>
      runSimpleCommand(
        matchId,
        (cmd, ctx) => cmd.card(matchId, ctx, actor, teamId.toLowerCase(), mapCardTypeToEngine(cardType), options),
      ),
    [runSimpleCommand, actor],
  );

  const handleTimePenalty = useCallback(
    (matchId: string, teamId: string, options?: { playerNumber?: number; durationSeconds?: number }) =>
      runSimpleCommand(matchId, (cmd, ctx) => cmd.timePenalty(matchId, ctx, actor, teamId.toLowerCase(), options)),
    [runSimpleCommand, actor],
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
