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
 * Spiel beenden (20261110_009): angepfiffen → nur Turnierleitung, nach Rückfrage Abpfiff und Ergebnis in einem Eintrag
 * (`scheduleEndMatch.ts`); Helfer bekommen den Weg nicht, im Strafstoßschießen abgelehnt.
 * B-49: Helfer bei laufendem Spiel auf fremd gesteuertem Feld → `offerTakeover` (Hinweis bzw. „Spielleitung übernehmen“,
 * @FU-081), sonst der Hinweis wie bisher (@FU-113).
 * Szenarien: @FU-080, @FU-081, @FU-082, @FU-093, @FU-094, @FU-097, @FU-069, @EK-004, @HE-042, @FU-112, @FU-113, @FU-114,
 * @FU-115, @FU-116, @FU-117, @FU-118.
 */
import { isTournamentClosedById } from '../../../core/services/closedTournaments';
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
import { readForeignFieldHolder } from '../../../core/repositories/fieldControlStateRpc';
import { getDeviceId } from '../../../core/device/deviceId';
import { fieldHolderText } from '../../match-engine/fieldHolderText';
import { endMatchFromSchedule, type EndPrompt } from './scheduleEndMatch';

export type ResultEntryPrompt =
  | { kind: 'reason'; matchNumber: number; before: string; after: string }
  | { kind: 'unskip'; matchNumber: number }
  | { kind: 'shootout'; matchNumber: number; score: string; homeName: string; awayName: string }
  | EndPrompt;

export interface ScheduleResultEntry {
  /** `false` = nichts gespeichert (Nein/Abbrechen/Ablehnung), die Eingabe-Zelle zeigt dann wieder den gespeicherten Stand */
  enterScore: (matchId: string, scoreA: number, scoreB: number) => Promise<boolean>;
  prompt: ResultEntryPrompt | null;
  /** Grund (`reason`), `'yes'` (abgesetzt, beenden), Strafstoßstand `'4:3'` (`shootout`) oder `null` = Abbruch. */
  answerPrompt: (answer: string | null) => void;
  /**
   * @FU-104: Name dessen, der den Stand eines Spiels zuletzt geändert hat (letzter Spielstand-Eintrag nach dem Abgleich,
   * Lesefunktion am Server); `null`, wenn er nicht bekannt ist (Gast, ohne Netz, ohne Recht, ohne Namen).
   */
  changeAuthor: (matchId: string) => Promise<string | null>;
}

export interface UseScheduleResultEntryOptions {
  tournament: Tournament;
  showWarning: (message: string) => void;
  lockFinishedResults: boolean;
  /**
   * B-49 (@FU-081): laufendes Spiel auf einem fremd gesteuerten Feld → Hinweis „Feld 2 wird gerade von Tom gesteuert“ bzw.
   * „Spielleitung übernehmen“ (`useScheduleTakeover`); `true` = erledigt, sonst der Hinweis „Spiel läuft“.
   */
  offerTakeover?: (matchId: string, field: number | null) => Promise<boolean>;
}

const score = (a: number, b: number): string => `${a}:${b}`;
/** Antwort der Strafstoß-Abfrage `'4:3'` → Stand je Team (Heim = Team A). */
const shootoutOf = (answer: string, teamAId: string, teamBId: string): Record<string, number> => {
  const [home, away] = answer.split(':').map(Number);
  return { [teamAId]: home, [teamBId]: away };
};

export function useScheduleResultEntry(options: UseScheduleResultEntryOptions): ScheduleResultEntry {
  const { tournament, showWarning, lockFinishedResults, offerTakeover } = options;
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const { t: tCommon } = useTranslation('common');
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

  const changeAuthor = useCallback(async (matchId: string): Promise<string | null> => {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === matchId);
    if (!entry || !context) {
      return null;
    }
    try {
      await context.engine.ensureMatch(entry.matchId, entry.ctx, tournament.id);
      await context.engine.catchUp(entry.matchId);
    } catch {
      return null;
    }
    return lastScoreAuthor(entry.matchId);
  }, [tournament, context, lastScoreAuthor]);

  /** Hinweise des Notwegs (Spiel beenden); veraltete App: der vorhandene Update-Hinweis (N3). */
  const endWarning = useCallback((key: 'offline' | 'notSent' | 'pending' | 'outdated'): string => {
    switch (key) {
      case 'offline': return t('schedule.resultEntry.endOffline');
      case 'pending': return t('schedule.resultEntry.endPending');
      case 'outdated': return tCommon('outbox.notice.clientOutdated');
      default: return t('schedule.resultEntry.endNotSent');
    }
  }, [t, tCommon]);

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
    if (isTournamentClosedById(tournament.id)) {
      // R3-3 (@LZ-036): zweite Linie -- der Spielplan bietet die Eingabe nach dem Abschluss nicht an; kommt sie doch, nie still verwerfen
      showWarning(t('rights.closedSaveBlocked'));
      return false;
    }
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
      if (route === 'shootout') {
        showWarning(t('schedule.resultEntry.shootoutRunning')); // @FU-118
        return false;
      }
      if (route === 'end' && actor !== 'leitung') {
        // @FU-113: Helfer bekommen den Weg nicht; B-49: fremd gesteuertes Feld → erst Übernahme anbieten (@FU-081)
        if (!(await offerTakeover?.(matchId, match?.field ?? null))) {
          showWarning(t('schedule.resultEntry.running'));
        }
        return false;
      }
      if (actor !== 'leitung') {
        showWarning(t(route === 'correct' ? 'schedule.resultEntry.correctionLeadOnly' : 'schedule.resultEntry.leadOnly'));
        return false;
      }
      if (route === 'end') {
        const { homeTeam, awayTeam } = entry.meta;
        eventId = await endMatchFromSchedule({
          engine, commands, sender: context.sender, guest: context.accountId === 'guest',
          entry, field: match?.field ?? null, entered: { home: scoreA, away: scoreB }, knockout,
          online: () => context.accountId === 'guest' || typeof navigator === 'undefined' || navigator.onLine,
          readHolder: async (field) => {
            const info = await readForeignFieldHolder(supabase, tournament.id, field, getDeviceId());
            return info ? { field: info.field, holder: fieldHolderText(info) } : null;
          },
          // @FU-081 (B-49): steuert ein anderes Gerät das Feld, bietet die Rückfrage zusätzlich „Spielleitung übernehmen“ an;
          // die Übernahme liest den Stand frisch (Epoche) und öffnet die Übernahme-Rückfrage, das Spiel bleibt unverändert.
          ask: async (endPrompt) => {
            const answer = await ask(offerTakeover !== undefined && endPrompt.controlledBy !== null ? { ...endPrompt, takeOver: true } : endPrompt);
            if (answer === 'takeover') {
              void offerTakeover?.(matchId, match?.field ?? null);
              return null;
            }
            return answer;
          },
          askShootout: async () => {
            const answer = await ask({ kind: 'shootout', matchNumber: entry.meta.number, score: score(scoreA, scoreB), homeName: homeTeam.name, awayName: awayTeam.name });
            return answer === null ? null : shootoutOf(answer, entry.ctx.teamAId, entry.ctx.teamBId);
          },
          warn: (key) => showWarning(endWarning(key)),
          pendingCount: async () => (await context.store.load(context.accountId, id))?.pending.length ?? 0,
          flush: () => context.sender.kick(id),
          warnStale: async (now) => showWarning(await staleText(entry, now)),
        });
        if (!eventId) {
          return false;
        }
      } else if (route === 'enter' || route === 'unskip') {
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
  }, [tournament, context, commands, actor, lockFinishedResults, showWarning, t, ask, trackAck, rejectionText, staleText, endWarning, offerTakeover]);

  return { enterScore, prompt, answerPrompt, changeAuthor };
}
