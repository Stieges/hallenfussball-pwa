/**
 * useScheduleResultEntry (A-08f3e2): Schnelleingabe im Spielplan über Server-Einträge.
 * `ensureMatch` → `catchUp` → Status aus der Engine-Ansicht DANACH (N-4) → Weiche:
 * geplant → `enterResult`; beendet → Grund-Auswahl → `correct` (Grundpflicht); abgesetzt → Rückfrage →
 * `unskipAndEnterResult` (ein Stapel); laufend → Hinweis. A-25a (@FU-094): K.-o.-Unentschieden → Abfrage des
 * Strafstoßergebnisses, ohne Angabe nichts gespeichert; A-08f3e4 Teil K (@FU-097): im abgesetzten K.-o.-Spiel ebenso,
 * nach der Rückfrage, im selben Stapel.
 * Fixrunde 1: Rückfragen nur, wenn der Eintrag zulässig ist -- veralteter Stand (M-1) und fehlende Rolle
 * (M-2, Wortlaut @HE-042) melden sofort. K.-o.-Auflösung über `useResultEntryAck` → `useKoResolutionAfterAck`.
 * UR (@FU-082): den Namen im Hinweis „inzwischen von … geändert“ liest `readEventAuthorNames` (Server-Lesefunktion),
 * ohne Namen bleibt es beim Text ohne „von …“.
 * Szenarien: @FU-080, @FU-081, @FU-082, @FU-093, @FU-094, @FU-097, @FU-069, @EK-004, @HE-042.
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
import { readEventAuthorNames } from '../../../core/repositories/eventAuthorNamesRpc';
import { supabase } from '../../../lib/supabase';

export type ResultEntryPrompt =
  | { kind: 'reason'; matchNumber: number; before: string; after: string }
  | { kind: 'unskip'; matchNumber: number }
  | { kind: 'shootout'; matchNumber: number; score: string; homeName: string; awayName: string };

export interface ScheduleResultEntry {
  /** `false` = nichts gespeichert (Nein/Abbrechen/Ablehnung), die Eingabe-Zelle zeigt dann wieder den gespeicherten Stand */
  enterScore: (matchId: string, scoreA: number, scoreB: number) => Promise<boolean>;
  prompt: ResultEntryPrompt | null;
  /** Grund (`reason`), `'yes'` (abgesetzt), Strafstoßstand `'4:3'` (`shootout`) oder `null` = Abbruch. */
  answerPrompt: (answer: string | null) => void;
}

export interface UseScheduleResultEntryOptions {
  tournament: Tournament;
  showWarning: (message: string) => void;
  lockFinishedResults: boolean;
}

const score = (a: number, b: number): string => `${a}:${b}`;
/** Antwort der Strafstoß-Abfrage `'4:3'` → Stand je Team (Heim = Team A). */
const shootoutOf = (answer: string, teamAId: string, teamBId: string): Record<string, number> => {
  const [home, away] = answer.split(':').map(Number);
  return { [teamAId]: home, [teamBId]: away };
};

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

  /** Name des Urhebers des letzten Spielstand-Eintrags (UR, Lesefunktion am Server); ohne Namen/bei Fehler `null`. */
  const lastScoreAuthor = useCallback(async (matchId: string): Promise<string | null> => {
    const eventId = context?.engine.view(matchId)?.result.state.lastScoreEventId;
    if (!eventId) {
      return null;
    }
    try {
      return (await readEventAuthorNames(supabase, matchId)).get(eventId)?.name ?? null;
    } catch {
      return null;
    }
  }, [context]);

  /** „Spiel 7 wurde inzwischen (von Olli) geändert (jetzt 2:2)“ (@FU-082). */
  const staleText = useCallback(async (entry: ValidMatchEntry, now: string): Promise<string> => {
    const author = await lastScoreAuthor(entry.matchId);
    return author
      ? t('schedule.resultEntry.stale', { number: entry.meta.number, name: author, score: now })
      : t('schedule.resultEntry.staleNoName', { number: entry.meta.number, score: now });
  }, [lastScoreAuthor, t]);

  const rejectionText = useCallback(async (error: unknown, entry: ValidMatchEntry): Promise<string> => {
    if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.STALE_BASE) {
      const current = (error.detail as { currentScores?: Record<string, number> } | undefined)?.currentScores ?? {};
      return staleText(entry, score(current[entry.ctx.teamAId] ?? 0, current[entry.ctx.teamBId] ?? 0));
    }
    if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.FORBIDDEN_ACTOR) {
      return t('schedule.resultEntry.leadOnly');
    }
    return tCockpit(rejectionMessageKey(error));
  }, [staleText, t, tCockpit]);

  const enterScore = useCallback(async (matchId: string, scoreA: number, scoreB: number): Promise<boolean> => {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
    if (!entry) {
      showWarning(t('schedule.resultEntry.teamsMissing'));
      return false;
    }
    if (!context || !commands) {
      showWarning(t('schedule.resultEntry.unavailable'));
      return false;
    }
    const match = tournament.matches.find((m) => m.id === matchId);
    const knockout = serverRulesFor(tournament, match).knockout;
    const knockoutDraw = knockout && scoreA === scoreB;
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
        return false;
      }
      const route = routeForStatus(state.status);
      let eventId: string | null = null;
      if (route === 'running') {
        showWarning(t('schedule.resultEntry.running'));
        return false;
      }
      if (actor !== 'leitung') {
        showWarning(t(route === 'correct' ? 'schedule.resultEntry.correctionLeadOnly' : 'schedule.resultEntry.leadOnly'));
        return false;
      }
      if (route === 'enter' || route === 'unskip') {
        // @FU-093: abgesetzt → erst die Rückfrage; @FU-094/@FU-097: K.-o.-Unentschieden → danach die Strafstoß-Abfrage.
        if (route === 'unskip' && (await ask({ kind: 'unskip', matchNumber: entry.meta.number })) === null) {
          return false;
        }
        let shootout: Record<string, number> | undefined;
        if (knockoutDraw) {
          const { homeTeam, awayTeam } = entry.meta;
          const answer = await ask({ kind: 'shootout', matchNumber: entry.meta.number, score: score(scoreA, scoreB), homeName: homeTeam.name, awayName: awayTeam.name });
          if (answer === null) {
            return false; // ohne Strafstoßergebnis wird nichts gespeichert (abgesetzt bleibt abgesetzt)
          }
          shootout = shootoutOf(answer, entry.ctx.teamAId, entry.ctx.teamBId);
        }
        eventId = route === 'unskip'
          ? await commands.unskipAndEnterResult(id, entry.ctx, actor, scores, shootout, knockout)
          : await commands.enterResult(id, entry.ctx, actor, scores, shootout, knockout);
      } else {
        if (lockFinishedResults) {
          showWarning(t('actions.matchAlreadyFinished'));
          return false;
        }
        const before = score(effectiveScoreFor(state, entry.ctx.teamAId), effectiveScoreFor(state, entry.ctx.teamBId));
        if (basedOn !== state.lastScoreEventId) {
          showWarning(await staleText(entry, before)); // M-1: inzwischen geändert -- keine Rückfrage
          return false;
        }
        const reason = await ask({ kind: 'reason', matchNumber: entry.meta.number, before, after: score(scoreA, scoreB) });
        if (!reason) {
          return false;
        }
        eventId = await commands.correct(id, entry.ctx, actor, scores, reason, basedOn);
      }
      if (eventId) {
        trackAck(eventId, entry);
      }
      return true;
    } catch (error) {
      showWarning(await rejectionText(error, entry));
      return false;
    }
  }, [tournament, context, commands, actor, lockFinishedResults, showWarning, t, ask, trackAck, rejectionText, staleText]);

  return { enterScore, prompt, answerPrompt };
}
