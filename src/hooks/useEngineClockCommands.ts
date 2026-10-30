/**
 * useEngineClockCommands (B-08b): die Uhr- und Abschnittsbefehle des Cockpits über `MatchCommands` –
 * `startSection` (Wiederanpfiff), `endSection`, `adjustClock` (Uhr korrigieren, Bedienung B-08d) und
 * `finish(timing)` (Spielende an der exakten Grenze). Eine Ablehnung (ungültiger Schritt, keine Engine-Kopie)
 * wird als Hinweis gemeldet (`onError`), nie geworfen; `silent` unterdrückt nur die Ablehnung (automatische
 * Enden), „Speicher voll“ wird immer gemeldet. Rückgabe: ID des gespeicherten Eintrags, `null` bei Ablehnung
 * oder Noop. Szenarien: @SL-005, @SL-006, @SL-009, @FU-070, @FU-071; `reopen` (LT-6): „Spiel fortsetzen“ mit Uhrstand (@SL-074).
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MatchCommandRejectedError, MatchCommands, type CommandTiming } from '../core/match/client';
import type { MatchContext } from '../core/match';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { rejectionMessageKey } from './engineCommandWiringHelpers';
import { useActorRole } from './useActorRole';

export interface ClockCommandsMatch {
  id: string;
  homeTeam: { id: string };
  awayTeam: { id: string };
}

export interface ClockCommandsParams {
  tournamentId: string;
  match: ClockCommandsMatch | null;
  /** Meldung an die Bedienung (Meldezeile). */
  onError: (message: string) => void;
}

export interface ClockCommandOptions {
  /** Automatisches Ende: eine Ablehnung bleibt still. */
  silent?: boolean;
}

export interface EngineClockCommands {
  startSection: () => Promise<string | null>;
  endSection: (timing?: CommandTiming, options?: ClockCommandOptions) => Promise<string | null>;
  adjustClock: (clockMs: number, previousClockMs: number) => Promise<string | null>;
  finish: (timing?: CommandTiming, options?: ClockCommandOptions) => Promise<string | null>;
  /** „Spiel fortsetzen“ (REOPEN): Uhr läuft ab `clockMs` (absolute Spieluhr) weiter. */
  reopen: (clockMs: number) => Promise<string | null>;
}

export function useEngineClockCommands({ tournamentId, match, onError }: ClockCommandsParams): EngineClockCommands {
  const { t } = useTranslation('cockpit');
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournamentId);
  const matchId = match?.id.toLowerCase() ?? null;
  const teamAId = match?.homeTeam.id ?? null;
  const teamBId = match?.awayTeam.id ?? null;

  const commands = useMemo(
    () =>
      context
        ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId })
        : null,
    [context],
  );
  const ctx = useMemo((): MatchContext | null => (matchId && teamAId && teamBId ? { matchId, teamAId, teamBId } : null), [matchId, teamAId, teamBId]);

  const run = useCallback(
    async (job: (cmd: MatchCommands, c: MatchContext) => Promise<string | null>, silent = false): Promise<string | null> => {
      if (!commands || !ctx) {
        if (!silent) { onError(t('engine.invalid')); }
        return null;
      }
      try {
        return await job(commands, ctx);
      } catch (error) {
        const ablehnung = error instanceof MatchCommandRejectedError;
        if (!(silent && ablehnung)) { onError(t(rejectionMessageKey(error))); }
        return null;
      }
    },
    [commands, ctx, onError, t],
  );

  const startSection = useCallback(() => run((cmd, c) => cmd.startSection(c.matchId, c, actor)), [run, actor]);
  const endSection = useCallback(
    (timing?: CommandTiming, options?: ClockCommandOptions) => run((cmd, c) => cmd.endSection(c.matchId, c, actor, timing), options?.silent),
    [run, actor],
  );
  const adjustClock = useCallback(
    (clockMs: number, previousClockMs: number) => run((cmd, c) => cmd.adjustClock(c.matchId, c, actor, clockMs, previousClockMs)),
    [run, actor],
  );
  const finish = useCallback(
    (timing?: CommandTiming, options?: ClockCommandOptions) => run((cmd, c) => cmd.finish(c.matchId, c, actor, timing), options?.silent),
    [run, actor],
  );

  const engine = context?.engine ?? null;
  const reopen = useCallback(
    (clockMs: number) => run((cmd, c) => cmd.reopen(c.matchId, c, actor, { clockMs, at: engine ? engine.serverNow() : Date.now() })),
    [run, actor, engine],
  );

  return useMemo(() => ({ startSection, endSection, adjustClock, finish, reopen }), [startSection, endSection, adjustClock, finish, reopen]);
}

