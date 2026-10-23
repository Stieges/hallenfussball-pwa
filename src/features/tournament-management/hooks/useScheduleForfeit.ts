/**
 * useScheduleForfeit (B-12): „nicht angetreten“ und „Wertung zurücknehmen“ im Spielplan der Turnierleitung.
 * `ensureMatch` → `catchUp` → Status aus der Engine-Ansicht DANACH (wie die Schnelleingabe) → Rückfrage → Befehl.
 * - markieren (@SL-174, derselbe Dialog im Spielplan und im Cockpit): nur aus `scheduled` (@FU-119), nur Turnierleitung (@SL-118, @HE-042); Auswahl Team A / Team B / beide, Rückfrage
 *   mit der Wertung der Einstellung (`forfeitResultFor`, @W2A-025) → `MatchCommands.forfeit` (`RESULT_ENTRY` mit `forfeit`).
 *   „Team ist abgereist“ (@W2A-023): zusätzlich je noch nicht begonnenem Spiel des Teams ein solcher Eintrag; angepfiffene Spiele
 *   werden übersprungen (@FU-119), gespielte bleiben unverändert.
 * - zurücknehmen: nur bei einer Wertung (letzte Überschreibung `forfeit`), Rückfrage → `reopen` (@W2A-026).
 * Szenarien: @W2A-022, @W2A-024, @W2A-025, @W2A-026, @TM-050, @TM-061, @TM-063, @FU-119, @SL-118.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ForfeitAbsent, Tournament } from '../../../types/tournament';
import { ERROR_CODES } from '../../../core/match';
import { MatchCommands, MatchCommandRejectedError } from '../../../core/match/client';
import { effectiveForfeitScore, forfeitResultFor } from '../../../core/models/forfeit';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import { useActorRole } from '../../../hooks/useActorRole';
import { buildValidMatches, type ValidMatchEntry } from '../../../hooks/engineMatchModel';
import { rejectionMessageKey } from '../../../hooks/engineCommandWiringHelpers';
import { useResultEntryAck } from './useResultEntryAck';

export type ForfeitPrompt =
  | {
      kind: 'mark';
      matchNumber: number;
      homeName: string;
      awayName: string;
      /** Tore der Wertung je Auswahl, „A“ = Heim fehlt, z. B. `0:2` */
      scores: Record<ForfeitAbsent, string>;
      /** Tore, die jede Seite bei „beide“ als Gegentore bekommt (Einstellung) */
      against: number;
      /** Wie viele weitere geplante Spiele das fehlende Team hat (Auswahl „abgereist“), je Seite */
      rest: { A: number; B: number };
    }
  | { kind: 'revoke'; matchNumber: number };

export interface ScheduleForfeit {
  /** Nur die Turnierleitung bietet die Bedienung an (@SL-118, @HE-042). */
  allowed: boolean;
  /** `false` = nichts gespeichert (Abbruch oder Ablehnung) */
  markForfeit: (matchId: string) => Promise<boolean>;
  revokeForfeit: (matchId: string) => Promise<boolean>;
  prompt: ForfeitPrompt | null;
  /** mark: `A`, `B`, `both` (nur dieses Spiel) bzw. `A:rest`, `B:rest` (auch alle restlichen Spiele); revoke: `'yes'`; `null` = Abbruch */
  answerPrompt: (answer: string | null) => void;
}

export interface UseScheduleForfeitOptions {
  tournament: Tournament;
  showWarning: (message: string) => void;
  /** Rückmeldung nach „auch alle restlichen Spiele werten“ */
  showSuccess?: (message: string) => void;
}

export function useScheduleForfeit({ tournament, showWarning, showSuccess }: UseScheduleForfeitOptions): ScheduleForfeit {
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournament.id);
  const [prompt, setPrompt] = useState<ForfeitPrompt | null>(null);
  const resolverRef = useRef<((answer: string | null) => void) | null>(null);
  const commands = useMemo(
    () => (context ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId }) : null),
    [context],
  );
  const onKoAfterSend = useCallback(() => showWarning(t('schedule.koAfterSend')), [showWarning, t]);
  const trackAck = useResultEntryAck({ context, tournament, onKoAfterSend });

  const ask = useCallback((next: ForfeitPrompt) => new Promise<string | null>((resolve) => {
    resolverRef.current?.(null);
    resolverRef.current = resolve;
    setPrompt(next);
  }), []);
  const answerPrompt = useCallback((answer: string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPrompt(null);
    resolve?.(answer);
  }, []);

  const rejectionText = useCallback((error: unknown): string => (
    error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.FORBIDDEN_ACTOR
      ? t('schedule.forfeit.leadOnly')
      : tCockpit(rejectionMessageKey(error))
  ), [t, tCockpit]);

  /** Gemeinsamer Anfang: Spiel, Engine, Stand nach `catchUp`; sonst Hinweis und `null`. */
  const prepare = useCallback(async (matchId: string) => {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
    if (!entry) {
      showWarning(t('schedule.forfeit.teamsMissing'));
      return null;
    }
    if (!context || !commands) {
      showWarning(t('schedule.forfeit.unavailable'));
      return null;
    }
    if (actor !== 'leitung') {
      showWarning(t('schedule.forfeit.leadOnly'));
      return null;
    }
    await context.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
    await context.engine.catchUp(entry.matchId);
    const state = context.engine.view(entry.matchId)?.result.state;
    if (!state) {
      showWarning(t('schedule.forfeit.unavailable'));
      return null;
    }
    return { entry, state, commands, actor };
  }, [tournament, context, commands, actor, showWarning, t]);

  /** @W2A-023: je noch nicht begonnenem Spiel des abgereisten Teams ein Eintrag; angepfiffene (@FU-119) und gespielte überspringen. */
  const forfeitRest = useCallback(async (entry: ValidMatchEntry, absent: 'A' | 'B', cmd: MatchCommands, who: 'leitung'): Promise<void> => {
    const teamId = absent === 'A' ? entry.ctx.teamAId : entry.ctx.teamBId;
    let done = 0;
    let skipped = 0;
    let failed = 0;
    for (const other of remainingMatchesOf(tournament, entry.matchId, teamId)) {
      const side = other.ctx.teamAId === teamId ? 'A' : 'B';
      try {
        await context?.engine.ensureMatch(other.matchId, other.ctx, tournament.id);
        await context?.engine.catchUp(other.matchId);
        const status = context?.engine.view(other.matchId)?.result.state.status;
        if (status === 'finished' || status === 'skipped') {
          continue; // gespielte bleiben unverändert (@W2A-023)
        }
        if (status !== 'scheduled') {
          skipped += 1; // angepfiffen: nicht werten (@FU-119)
          continue;
        }
        const eventId = await cmd.forfeit(other.matchId, other.ctx, who, side, forfeitResultFor(tournament, side));
        if (eventId) {
          trackAck(eventId, other);
        }
        done += 1;
      } catch {
        failed += 1;
      }
    }
    if (skipped + failed > 0) {
      showWarning(t('schedule.forfeit.restPartial', { done, skipped: skipped + failed }));
    } else {
      showSuccess?.(t('schedule.forfeit.restDone', { count: done }));
    }
  }, [tournament, context, trackAck, showWarning, showSuccess, t]);

  const markForfeit = useCallback(async (matchId: string): Promise<boolean> => {
    try {
      const ready = await prepare(matchId);
      if (!ready) {
        return false;
      }
      const { entry, state } = ready;
      const restOf = (teamId: string): number => remainingMatchesOf(tournament, entry.matchId, teamId).length;
      if (state.status !== 'scheduled') {
        showWarning(t('schedule.forfeit.notScheduled')); // @FU-119: nur aus „geplant“
        return false;
      }
      const answer = await ask({
        kind: 'mark',
        matchNumber: entry.meta.number,
        homeName: entry.meta.homeTeam.name,
        awayName: entry.meta.awayTeam.name,
        scores: {
          A: `${forfeitResultFor(tournament, 'A').a}:${forfeitResultFor(tournament, 'A').b}`,
          B: `${forfeitResultFor(tournament, 'B').a}:${forfeitResultFor(tournament, 'B').b}`,
          both: '0:0',
        },
        against: effectiveForfeitScore(tournament).winner,
        rest: { A: restOf(entry.ctx.teamAId), B: restOf(entry.ctx.teamBId) },
      });
      const [absent, scope] = (answer ?? '').split(':');
      if (absent !== 'A' && absent !== 'B' && absent !== 'both') {
        return false;
      }
      const eventId = await ready.commands.forfeit(entry.matchId, entry.ctx, ready.actor, absent, forfeitResultFor(tournament, absent));
      if (eventId) {
        trackAck(eventId, entry); // @TM-061: im K.-o. rückt der Gegner weiter
      }
      if (scope === 'rest' && absent !== 'both') {
        await forfeitRest(entry, absent, ready.commands, ready.actor);
      }
      return true;
    } catch (error) {
      showWarning(rejectionText(error));
      return false;
    }
  }, [prepare, ask, tournament, showWarning, t, trackAck, rejectionText, forfeitRest]);

  const revokeForfeit = useCallback(async (matchId: string): Promise<boolean> => {
    try {
      const ready = await prepare(matchId);
      if (!ready) {
        return false;
      }
      const { entry, state } = ready;
      const isForfeit = state.status === 'finished' && state.overrides[state.overrides.length - 1]?.kind === 'forfeit';
      if (!isForfeit) {
        showWarning(t('schedule.forfeit.notForfeit'));
        return false;
      }
      if ((await ask({ kind: 'revoke', matchNumber: entry.meta.number })) !== 'yes') {
        return false;
      }
      await ready.commands.reopen(entry.matchId, entry.ctx, ready.actor);
      return true;
    } catch (error) {
      showWarning(rejectionText(error));
      return false;
    }
  }, [prepare, ask, showWarning, t, rejectionText]);

  return { allowed: actor === 'leitung', markForfeit, revokeForfeit, prompt, answerPrompt };
}

/** Weitere noch geplante Spiele des Teams (Turnierkopie: nicht gespielt, nicht abgesetzt, ohne Ergebnis), ohne das gewählte Spiel. */
function remainingMatchesOf(tournament: Tournament, exceptMatchId: string, teamId: string): ValidMatchEntry[] {
  return buildValidMatches(tournament).filter((other) => (
    other.matchId !== exceptMatchId
    && (other.ctx.teamAId === teamId || other.ctx.teamBId === teamId)
    && (other.matchStatus === undefined || other.matchStatus === 'scheduled')
    && !other.hasExistingResult
  ));
}
