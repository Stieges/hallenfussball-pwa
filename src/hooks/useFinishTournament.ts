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
 * - Zustandsgrenzen (R3-4, Review #393 m-1): `confirm()` nur aus `confirming`, `retry()` nur aus `unconfirmed`, `start()` nie
 *   während des Sendens; jede Ablehnung leert Endstand und `request_id` (E3: ein neuer Durchlauf = eine neue ID); ein älterer
 *   Durchlauf überschreibt nie den Zustand eines neueren (Durchlauf-Zähler).
 * - Der Dienst bekommt den ROHEN Cloud-Stand (`loadRaw`, Review #393 H-2), nie die Engine-Überlagerung der Anzeige – sonst
 *   weicht der Stand vom bestätigten Serverstand ab und der Abschluss endet in „Stand neu laden“.
 * - `ALREADY_FINISHED` (auch ohne Person, Review H-5): die App lädt neu; sie behauptet nie, jemand anderes habe abgeschlossen.
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
  /**
   * Der rohe Cloud-Stand des Turniers (frisch gelesen, ohne Überlagerung der Spielsteuerung), H-2 aus Review #393.
   * `null` = nicht lesbar → „Prüfung gescheitert“. Ohne diese Angabe gilt das übergebene Turnier.
   */
  loadRaw?: () => Promise<Tournament | null>;
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
      return { code: 'ALREADY_FINISHED', at: result.at, ...(result.by ? { by: result.by } : {}) };
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

/** Zeitgrenze je Lese-Stufe der Prüfung (Stand lesen, Spiel-Ereignisse laden): hängt eine Stufe, endet die Prüfung mit „Prüfung gescheitert“ statt endlos „wird geprüft“. */
export const FINISH_STAGE_TIMEOUT_MS = 20_000;
const STAGE_TIMED_OUT = Symbol('stage-timed-out');

async function stage<T>(name: string, work: Promise<T>): Promise<T | typeof STAGE_TIMED_OUT> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof STAGE_TIMED_OUT>((resolve) => { timer = setTimeout(() => { resolve(STAGE_TIMED_OUT); }, FINISH_STAGE_TIMEOUT_MS); });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- Messung der Prüfdauer je Stufe (nur Entwicklung, von der Cloud-E2E N6c2 gelesen)
      console.info(`[finish] ${name} ${String(Date.now() - started)} ms`);
    }
  }
}

/** H-6 (Review #393): die Startseite lädt ihre Liste neu, sonst bliebe das Turnier dort unter „Läuft“ (@LZ-006). */
const announceTournamentUpdated = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tournament-updated'));
  }
};

export function useFinishTournament(tournament: Tournament | null, { reload, loadRaw }: FinishTournamentOptions): FinishTournamentApi {
  const tournamentId = tournament?.id ?? '';
  const { tournamentRepository } = useRepositories();
  const canManage = useCan('manageLifecycle', tournamentId);
  const online = useIsOnline();
  const engineContext = useMatchEngineContextOptional();
  const [state, setState] = useState<FinishState>({ phase: 'idle' });

  const local = tournamentRepository instanceof LocalStorageRepository;
  const latest = useRef({ tournament, online, canManage, engineContext, reload, loadRaw, local });
  latest.current = { tournament, online, canManage, engineContext, reload, loadRaw, local };
  const run = useRef<{ requestId: string; ready: FinishReady | null; attempt: number }>({ requestId: '', ready: null, attempt: 0 });
  const phase = useRef<FinishState['phase']>('idle'); // synchron lesbar: confirm()/retry()/start() prüfen die Phase (m-1)
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const set = useCallback((next: FinishState) => {
    phase.current = next.phase;
    if (next.phase === 'rejected') {
      run.current = { ...run.current, requestId: '', ready: null }; // E3: nach einer Ablehnung gilt nichts vom alten Durchlauf
    }
    if (mounted.current) { setState(next); }
  }, []);

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
    if (phase.current === 'sending') {
      return; // m-1: während des Sendens beginnt kein neuer Durchlauf (kein zweiter Abschluss mit neuer ID)
    }
    const { tournament: current, engineContext: context } = latest.current;
    const mine = run.current.attempt + 1;
    run.current = { requestId: crypto.randomUUID(), ready: null, attempt: mine };
    const outdated = () => mine !== run.current.attempt; // m-1: ein neuerer Durchlauf (oder reset) gilt
    const blocked = gate();
    if (blocked !== null || current === null) {
      set({ phase: 'rejected', reason: blocked ?? { code: 'CHECK_FAILED' } });
      return;
    }
    set({ phase: 'checking' });
    try {
      const [preflight, reviews, raw] = await Promise.all([
        readFinishPreflight(client(), current.id), readMatchReviews(client(), current.id),
        stage('raw', latest.current.loadRaw ? latest.current.loadRaw().catch(() => null) : Promise.resolve(current)),
      ]);
      if (outdated()) {
        return;
      }
      if (preflight.status !== 'ok' || !reviews.ok || raw === null || raw === STAGE_TIMED_OUT) {
        set({ phase: 'rejected', reason: preflight.status === 'forbidden' ? { code: 'FORBIDDEN' } : { code: 'CHECK_FAILED' } });
        return;
      }
      let engineEventsById;
      try {
        const loaded = context !== null ? await stage('engine', loadEngineEventsForExport(raw, context)) : undefined;
        if (loaded === STAGE_TIMED_OUT) {
          throw new Error('Ereignisse nicht rechtzeitig geladen');
        }
        engineEventsById = loaded;
      } catch {
        if (!outdated()) {
          set({ phase: 'rejected', reason: { code: 'CHECK_FAILED' } });
        }
        return;
      }
      if (outdated()) {
        return;
      }
      const ownPending = context?.sender.getStatus().pendingByTournament[raw.id] ?? 0;
      const prepared = prepareFinish({
        tournament: raw, preflight: preflight.preflight, reviews: reviews.reviews, ownPending, engineEventsById,
        appVersion: __BUILD_HASH__, computedAt: new Date().toISOString(),
      });
      if (!prepared.ok) {
        set({ phase: 'rejected', reason: prepared.blocker });
        if (prepared.blocker.code === 'ALREADY_FINISHED') {
          await latest.current.reload(); // H-5: das Turnier ist abgeschlossen – die Ansicht folgt dem Server
          announceTournamentUpdated();
        }
        return;
      }
      run.current.ready = prepared.ready;
      set({ phase: 'confirming', ready: prepared.ready });
    } catch (error) {
      // Eine unerwartete Ausnahme in der Prüfung (Rechnung, Lesen) darf nie als „wird geprüft“ stehen bleiben
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- Ursache der gescheiterten Prüfung (nur Entwicklung, von der Cloud-E2E N6c2 gelesen)
        console.info(`[finish] Fehler: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
      }
      if (!outdated()) {
        set({ phase: 'rejected', reason: { code: 'CHECK_FAILED' } });
      }
    }
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
      await latest.current.reload(); // E3: nach dem Abschluss immer neu laden, dann erst „fertig“ (die Ansicht zeigt schon Zustand C)
      announceTournamentUpdated();
      set({ phase: 'done', finishedAt: result.finishedAt, alreadyApplied: result.alreadyApplied });
      return;
    }
    if (result.status !== 'noAnswer') {
      const reason = rejectionOf(result);
      set({ phase: 'rejected', reason });
      if (reason.code === 'ALREADY_FINISHED') {
        await latest.current.reload(); // H-5: schon abgeschlossen – die Ansicht folgt dem Server
        announceTournamentUpdated();
      }
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
      announceTournamentUpdated();
    }
  }, [set]);

  const confirm = useCallback(async () => {
    const t = latest.current.tournament;
    if (phase.current !== 'confirming' || run.current.ready === null || t === null) {
      return; // m-1: bestätigen geht nur aus „bereit“
    }
    const blocked = gate();
    if (blocked !== null) {
      set({ phase: 'rejected', reason: blocked });
      return;
    }
    const mine = run.current.attempt;
    set({ phase: 'sending' });
    // S2: die Klärungsliste unmittelbar vor dem Abschluss erneut lesen (verkleinert das Fenster bis W-M)
    const reviews = await readMatchReviews(client(), t.id);
    if (mine !== run.current.attempt) {
      return;
    }
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
    if (phase.current !== 'unconfirmed') {
      return; // m-1: erneut senden nur nach ausgebliebener Antwort, mit derselben request_id
    }
    const blocked = gate();
    if (blocked !== null) {
      set({ phase: 'rejected', reason: blocked });
      return;
    }
    await send();
  }, [gate, send, set]);

  const reset = useCallback(() => {
    if (phase.current === 'sending') {
      return; // der Aufruf läuft: Abbrechen ist gesperrt (@LZ-021)
    }
    run.current = { requestId: '', ready: null, attempt: run.current.attempt + 1 };
    set({ phase: 'idle' });
  }, [set]);

  return { state, start, confirm, retry, reset };
}
