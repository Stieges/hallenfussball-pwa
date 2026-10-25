/**
 * useFinishTournament – Abschluss-Dienst „Turnier abschließen“ (Plan R3-2b, E3–E5, S1, S2; Übergabe A-21a-C1). Kein Dialog
 * (der kommt mit R3-4), nur der Ablauf:
 *
 *   idle ─start()→ checking ─→ confirming ─confirm()→ sending ─→ done
 *                     │             │                    ├─→ rejected (Grund)
 *                     └→ rejected   └→ rejected (S2)     └─→ unconfirmed ─retry()→ sending (DIESELBE request_id)
 *
 * - Nur mit Netz (@LZ-019): ohne Netz kein Aufruf, nichts wird gemerkt oder später nachgereicht.
 * - Nur mit Recht `manageLifecycle` (@LZ-022, @LZ-023) und nicht im Gast-Speicher (E9) – sonst kein Aufruf.
 * - `start()` liest `finish_preflight` und die Klärungsliste und rechnet den Endstand auf dem bestätigten Stand (E4, E5).
 * - `confirm()` liest die Klärungsliste unmittelbar vor dem Senden erneut (S2) und sendet mit der `request_id` dieses
 *   Durchlaufs; bleibt die Antwort 15 s aus (@LZ-021) → `unconfirmed`, der Stand wird beim Server abgefragt, und
 *   `retry()` sendet mit derselben ID (der Server antwortet dann `alreadyApplied`).
 * - Nach `ok` lädt die App das Turnier neu (E3, Review H-1). Ein abgelehnter oder unbestätigter Abschluss ändert lokal nichts
 *   (@LZ-024: kein Teilzustand).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tournament } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';
import { readMatchReviews } from '../core/repositories/matchReviewsRpc';
import {
  callFinishTournament, readFinishPreflight, readTournamentLifecycle, type FinishTournamentResult,
} from '../core/repositories/lifecycleRpc';
import { openReviewItems, prepareFinish, type FinishBlocker, type FinishReady } from '../core/services/finishPreparation';
import type { TournamentLifecycle } from '../core/services/lifecycle';
import { useCan } from '../features/auth/hooks/useCan';
import { loadEngineEventsForExport } from '../features/match-engine/loadEngineEventsForExport';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useIsOnline } from './useOnlineStatus';

/** Warum der Abschluss nicht stattfand (vor oder nach dem Senden). */
export type FinishRejection =
  | FinishBlocker
  | { code: 'OFFLINE' }
  | { code: 'FORBIDDEN' }
  | { code: 'LOCAL' }
  | { code: 'CHECK_FAILED' }
  | { code: 'REQUEST_ID_CONFLICT' | 'INVALID_INPUT' | 'UNEXPECTED' };

export type FinishState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'confirming'; ready: FinishReady }
  | { phase: 'sending' }
  | { phase: 'unconfirmed'; serverLifecycle: TournamentLifecycle | null | undefined }
  | { phase: 'done'; finishedAt: string; alreadyApplied: boolean }
  | { phase: 'rejected'; reason: FinishRejection };

export interface FinishTournamentApi {
  state: FinishState;
  /** Neuer Dialog-Durchlauf: neue `request_id`, Prüfung beim Server. */
  start: () => Promise<void>;
  /** Bestätigen (nur aus `confirming`). */
  confirm: () => Promise<void>;
  /** Erneut senden nach ausgebliebener Antwort – mit derselben `request_id` (nur aus `unconfirmed`). */
  retry: () => Promise<void>;
  reset: () => void;
}

export interface FinishTournamentOptions {
  /** Turnier neu laden (nach dem Abschluss, E3; und wenn der Server nach ausgebliebener Antwort „abgeschlossen“ meldet). */
  reload: () => void | Promise<void>;
}

function rejectionOf(result: Exclude<FinishTournamentResult, { status: 'ok' } | { status: 'noAnswer' }>): FinishRejection {
  if (result.status === 'forbidden') {
    return { code: 'FORBIDDEN' };
  }
  if (result.status === 'unexpected') {
    return { code: 'UNEXPECTED' };
  }
  if (result.code === 'INVALID_STANDINGS' && result.reason === 'PROVISIONAL') {
    return { code: 'PROVISIONAL' };
  }
  switch (result.code) {
    case 'ALREADY_FINISHED':
      return { code: 'ALREADY_FINISHED', at: result.at };
    case 'NOT_RUNNING':
      return { code: 'NOT_RUNNING', lifecycle: result.lifecycle ?? '' };
    case 'OPEN_ITEMS':
      return { code: 'OPEN_ITEMS', items: result.items };
    case 'INVALID_STANDINGS':
      return { code: 'INVALID_STANDINGS', reason: result.reason };
    default:
      return { code: result.code };
  }
}

const client = () => (isSupabaseConfigured ? supabase : null);

export function useFinishTournament(tournament: Tournament | null, { reload }: FinishTournamentOptions): FinishTournamentApi {
  const tournamentId = tournament?.id ?? '';
  const { tournamentRepository } = useRepositories();
  const canManage = useCan('manageLifecycle', tournamentId);
  const online = useIsOnline();
  const engineContext = useMatchEngineContextOptional();
  const [state, setState] = useState<FinishState>({ phase: 'idle' });

  const latest = useRef({ tournament, online, canManage, engineContext, reload, local: tournamentRepository instanceof LocalStorageRepository });
  latest.current = { tournament, online, canManage, engineContext, reload, local: tournamentRepository instanceof LocalStorageRepository };
  const run = useRef<{ requestId: string; ready: FinishReady | null; attempt: number }>({ requestId: '', ready: null, attempt: 0 });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const set = useCallback((next: FinishState) => { if (mounted.current) { setState(next); } }, []);

  /** Sperren vor jedem Aufruf (@LZ-019, @LZ-022, E9); `null` = darf. */
  const gate = useCallback((): FinishRejection | null => {
    const now = latest.current;
    if (now.local) {
      return { code: 'LOCAL' };
    }
    if (!now.canManage) {
      return { code: 'FORBIDDEN' };
    }
    return now.online && (typeof navigator === 'undefined' || navigator.onLine) ? null : { code: 'OFFLINE' };
  }, []);

  const start = useCallback(async () => {
    const { tournament: t, engineContext: context } = latest.current;
    run.current = { requestId: crypto.randomUUID(), ready: null, attempt: run.current.attempt + 1 };
    const blocked = gate();
    if (blocked !== null || t === null) {
      set({ phase: 'rejected', reason: blocked ?? { code: 'CHECK_FAILED' } });
      return;
    }
    set({ phase: 'checking' });
    const [preflight, reviews] = await Promise.all([readFinishPreflight(client(), t.id), readMatchReviews(client(), t.id)]);
    if (preflight.status !== 'ok' || !reviews.ok) {
      set({ phase: 'rejected', reason: preflight.status === 'forbidden' ? { code: 'FORBIDDEN' } : { code: 'CHECK_FAILED' } });
      return;
    }
    let engineEventsById;
    try {
      engineEventsById = context !== null ? await loadEngineEventsForExport(t, context) : undefined;
    } catch {
      set({ phase: 'rejected', reason: { code: 'CHECK_FAILED' } });
      return;
    }
    const ownPending = context?.sender.getStatus().pendingByTournament[t.id] ?? 0;
    const prepared = prepareFinish({
      tournament: t, preflight: preflight.preflight, reviews: reviews.reviews, ownPending, engineEventsById,
      appVersion: __BUILD_HASH__, computedAt: new Date().toISOString(),
    });
    if (!prepared.ok) {
      set({ phase: 'rejected', reason: prepared.blocker });
      return;
    }
    run.current.ready = prepared.ready;
    set({ phase: 'confirming', ready: prepared.ready });
  }, [gate, set]);

  const send = useCallback(async () => {
    const { ready, requestId } = run.current;
    const t = latest.current.tournament;
    if (ready === null || t === null) {
      return;
    }
    const attempt = ++run.current.attempt;
    set({ phase: 'sending' });
    const result = await callFinishTournament(client(), { tournamentId: t.id, expectedState: ready.expectedState, snapshot: ready.snapshot, requestId });
    if (attempt !== run.current.attempt) {
      return;
    }
    if (result.status === 'ok') {
      set({ phase: 'done', finishedAt: result.finishedAt, alreadyApplied: result.alreadyApplied });
      await latest.current.reload();
      return;
    }
    if (result.status !== 'noAnswer') {
      set({ phase: 'rejected', reason: rejectionOf(result) });
      return;
    }
    // @LZ-021: nach höchstens 15 s „nicht bestätigt“ zeigen und den Stand beim Server abfragen
    set({ phase: 'unconfirmed', serverLifecycle: undefined });
    const serverLifecycle = await readTournamentLifecycle(client(), t.id);
    if (attempt !== run.current.attempt) {
      return;
    }
    set({ phase: 'unconfirmed', serverLifecycle });
    if (serverLifecycle === 'finished') {
      await latest.current.reload();
    }
  }, [set]);

  const confirm = useCallback(async () => {
    const t = latest.current.tournament;
    if (run.current.ready === null || t === null) {
      return;
    }
    const blocked = gate();
    if (blocked !== null) {
      set({ phase: 'rejected', reason: blocked });
      return;
    }
    set({ phase: 'sending' });
    // S2: die Klärungsliste unmittelbar vor dem Abschluss erneut lesen (verkleinert das Fenster bis W-M)
    const reviews = await readMatchReviews(client(), t.id);
    if (!reviews.ok) {
      set({ phase: 'rejected', reason: { code: 'CHECK_FAILED' } });
      return;
    }
    const open = openReviewItems(reviews.reviews);
    if (open.length > 0) {
      set({ phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: open } });
      return;
    }
    await send();
  }, [gate, send, set]);

  const retry = useCallback(async () => {
    const blocked = gate();
    if (blocked !== null) {
      set({ phase: 'rejected', reason: blocked });
      return;
    }
    await send();
  }, [gate, send, set]);

  const reset = useCallback(() => {
    run.current = { requestId: '', ready: null, attempt: run.current.attempt + 1 };
    set({ phase: 'idle' });
  }, [set]);

  return { state, start, confirm, retry, reset };
}
