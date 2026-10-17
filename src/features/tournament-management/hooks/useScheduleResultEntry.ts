/**
 * useScheduleResultEntry (A-08f3e2): Schnelleingabe im Spielplan über Server-Einträge.
 * `ensureMatch` → `catchUp` → Status aus der Engine-Ansicht DANACH (N-4) → Weiche:
 * geplant → `enterResult`; beendet → Grund-Auswahl → `correct` (Grundpflicht); abgesetzt → Rückfrage →
 * `unskipAndEnterResult` (ein Stapel); laufend → Hinweis. K.-o.-Unentschieden → Hinweis, nichts gespeichert
 * (Strafstoßergebnis im Direkteintrag kommt mit A-25a, Befund C-DIREKTEINTRAG-OHNE-STRAFSTOSS).
 * Fixrunde 1: Rückfragen nur, wenn der Eintrag zulässig ist -- veralteter Stand (M-1) und fehlende Rolle
 * (M-2, Wortlaut @HE-042) melden sofort. K.-o.-Auflösung über `useResultEntryAck` → `useKoResolutionAfterAck`.
 * Szenarien: @FU-080, @FU-081, @FU-082, @FU-093, @FU-094 (Teil), @FU-069, @EK-004, @HE-042.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../../../types/tournament';
import { ERROR_CODES, effectiveScoreFor } from '../../../core/match';
import { MatchCommands, MatchCommandRejectedError } from '../../../core/match/client';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import { useActorRole } from '../../../hooks/useActorRole';
import { serverRulesFor } from '../../../hooks/engineServerRules';
import { buildValidMatches, type ValidMatchEntry } from '../../../hooks/engineMatchModel';
import { rejectionMessageKey } from '../../../hooks/engineCommandWiringHelpers';
import { routeForStatus } from './scoreChangeHelpers';
import { useResultEntryAck } from './useResultEntryAck';

export type ResultEntryPrompt =
  | { kind: 'reason'; matchNumber: number; before: string; after: string }
  | { kind: 'unskip'; matchNumber: number };

export interface ScheduleResultEntry {
  enterScore: (matchId: string, scoreA: number, scoreB: number) => Promise<void>;
  prompt: ResultEntryPrompt | null;
  /** Grund (`reason`), `'yes'` (abgesetzt) oder `null` = Abbruch. */
  answerPrompt: (answer: string | null) => void;
}

export interface UseScheduleResultEntryOptions {
  tournament: Tournament;
  showWarning: (message: string) => void;
  lockFinishedResults: boolean;
}

const score = (a: number, b: number): string => `${a}:${b}`;

export function useScheduleResultEntry(options: UseScheduleResultEntryOptions): ScheduleResultEntry {
  const { tournament, showWarning, lockFinishedResults } = options;
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const context = useMatchEngineContextOptional();
  const actor = useActorRole(tournament.id);
  const [prompt, setPrompt] = useState<ResultEntryPrompt | null>(null);
  const resolverRef = useRef<((answer: string | null) => void) | null>(null);

  const commands = useMemo(
    () => (context ? new MatchCommands({ engine: context.engine, store: context.store, sender: context.sender, accountId: context.accountId }) : null),
    [context],
  );
  const onKoAfterSend = useCallback(() => showWarning(t('schedule.koAfterSend')), [showWarning, t]);
  const trackAck = useResultEntryAck({ context, tournament, onKoAfterSend });

  const ask = useCallback((next: ResultEntryPrompt) => new Promise<string | null>((resolve) => {
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

  /** „Spiel 7 wurde inzwischen (von …) geändert (jetzt 2:2)“ -- Urheber kennt der Server nicht (C-EREIGNIS-OHNE-URHEBER). */
  const staleText = useCallback((entry: ValidMatchEntry, now: string): string => {
    const state = context?.engine.view(entry.matchId)?.result.state;
    const author = state?.lastScoreEventId ? state.accepted[state.lastScoreEventId]?.actorUser : undefined;
    return author
      ? t('schedule.resultEntry.stale', { number: entry.meta.number, name: author, score: now })
      : t('schedule.resultEntry.staleNoName', { number: entry.meta.number, score: now });
  }, [context, t]);

  const rejectionText = useCallback((error: unknown, entry: ValidMatchEntry): string => {
    if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.STALE_BASE) {
      const current = (error.detail as { currentScores?: Record<string, number> } | undefined)?.currentScores ?? {};
      return staleText(entry, score(current[entry.ctx.teamAId] ?? 0, current[entry.ctx.teamBId] ?? 0));
    }
    if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.FORBIDDEN_ACTOR) {
      return t('schedule.resultEntry.leadOnly');
    }
    return tCockpit(rejectionMessageKey(error));
  }, [staleText, t, tCockpit]);

  const enterScore = useCallback(async (matchId: string, scoreA: number, scoreB: number) => {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
    if (!entry) {
      showWarning(t('schedule.resultEntry.teamsMissing'));
      return;
    }
    if (!context || !commands) {
      showWarning(t('schedule.resultEntry.unavailable'));
      return;
    }
    const match = tournament.matches.find((m) => m.id === matchId);
    if (scoreA === scoreB && serverRulesFor(tournament, match).knockout) {
      showWarning(t('schedule.resultEntry.knockoutDraw'));
      return;
    }
    const { engine } = context;
    const id = entry.matchId;
    const scores = { [entry.ctx.teamAId]: scoreA, [entry.ctx.teamBId]: scoreB };
    try {
      await engine.ensureMatch(id, entry.ctx, tournament.id);
      // Stand, den die Turnierleitung kannte -- Grundlage der Korrektur (@FU-082: veraltet → STALE_BASE).
      const basedOn = engine.view(id)?.result.state.lastScoreEventId ?? null;
      await engine.catchUp(id);
      const state = engine.view(id)?.result.state;
      if (!state) {
        showWarning(t('schedule.resultEntry.unavailable'));
        return;
      }
      const route = routeForStatus(state.status);
      let eventId: string | null = null;
      if (route === 'running') {
        showWarning(t('schedule.resultEntry.running'));
        return;
      }
      if (actor !== 'leitung') {
        showWarning(t(route === 'correct' ? 'schedule.resultEntry.correctionLeadOnly' : 'schedule.resultEntry.leadOnly'));
        return;
      }
      if (route === 'enter') {
        eventId = await commands.enterResult(id, entry.ctx, actor, scores);
      } else if (route === 'unskip') {
        if ((await ask({ kind: 'unskip', matchNumber: entry.meta.number })) === null) {
          return;
        }
        eventId = await commands.unskipAndEnterResult(id, entry.ctx, actor, scores);
      } else {
        if (lockFinishedResults) {
          showWarning(t('actions.matchAlreadyFinished'));
          return;
        }
        const before = score(effectiveScoreFor(state, entry.ctx.teamAId), effectiveScoreFor(state, entry.ctx.teamBId));
        if (basedOn !== state.lastScoreEventId) {
          showWarning(staleText(entry, before)); // M-1: inzwischen geändert -- keine Rückfrage
          return;
        }
        const reason = await ask({ kind: 'reason', matchNumber: entry.meta.number, before, after: score(scoreA, scoreB) });
        if (!reason) {
          return;
        }
        eventId = await commands.correct(id, entry.ctx, actor, scores, reason, basedOn);
      }
      if (eventId) {
        trackAck(eventId, entry);
      }
    } catch (error) {
      showWarning(rejectionText(error, entry));
    }
  }, [tournament, context, commands, actor, lockFinishedResults, showWarning, t, ask, trackAck, rejectionText, staleText]);

  return { enterScore, prompt, answerPrompt };
}
