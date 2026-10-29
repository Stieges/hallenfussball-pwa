/**
 * Lade-Hook des Monitors (B-16b2, R5 PR 1 „Sofort-Kanal“).
 *
 * Abruf: monitorDataSource.ts · Zustandsregeln: monitorDisplayState.ts · Einblendungen: monitorOverlays.ts ·
 * dieser Hook: wann abgerufen wird, Ziel-Wechsel, Aufräumen beim Unmount.
 *
 * Wann abgerufen wird (Zone 1 „Aktualität“, @ZM-084, @FU-001, @ZM-123):
 * - sofort auf jedes Änderungssignal der Quelle (Server `display:<id>`, im selben Browser die Engine),
 * - im Rückfall-Takt (`pollIntervalFor`, 2 s; lokal 1 s), falls ein Signal verloren geht,
 * - sofort, wenn das Fenster wieder sichtbar wird oder das Netz zurückkommt.
 * Läuft schon ein Abruf, wird genau EIN Nachabruf vorgemerkt (früher verworfen). Zwei Abrufe beginnen nie näher als
 * `MIN_FETCH_GAP_MS` beieinander (Signal-Flut, fremde Signale auf dem öffentlichen Kanal).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TournamentMonitor } from '../../types/monitor';
import type { CardEventInfo, GoalEventInfo } from '../../hooks/useLiveMatches';
import type { DisplayOrigin, MonitorDataSource } from './monitorDataSource';
import { requestUrgentReload } from '../../lib/swRegistration';
import {
  applyDelta,
  applyFetchError,
  initialDisplayState,
  type MonitorDisplayState,
} from './monitorDisplayState';
import { boundFieldNumbers, cardIdsOf, detectOverlays } from './monitorOverlays';

/** Kleinster Abstand zwischen zwei Abruf-Beginnen (Plan R5 § 6 Risiko 2/3). */
export const MIN_FETCH_GAP_MS = 250;

export interface MonitorDisplayTarget {
  tournamentId: string;
  monitorId: string;
}

export interface MonitorDisplayData extends MonitorDisplayState {
  /** Tor-Einblendung, die gerade dran ist (Warteschlange; aus derselben Antwort wie Stand und Uhr). */
  goalEvent: GoalEventInfo | null;
  /** Karten-Einblendung, die gerade dran ist. */
  cardEvent: CardEventInfo | null;
  clearGoalEvent: () => void;
  clearCardEvent: () => void;
}

interface Overlays {
  goals: GoalEventInfo[];
  cards: CardEventInfo[];
}

/**
 * @param pollIntervalFor Rückfall-Takt in ms, abhängig vom geladenen Monitor und der Herkunft (cloud/lokal).
 */
export function useMonitorDisplayData(
  source: MonitorDataSource,
  target: MonitorDisplayTarget,
  pollIntervalFor: (monitor: TournamentMonitor | null, origin: DisplayOrigin | null) => number
): MonitorDisplayData {
  const { tournamentId, monitorId } = target;
  const [state, setState] = useState<MonitorDisplayState>(() => ({
    ...initialDisplayState,
    lastFetch: Date.now(),
  }));
  const [overlays, setOverlays] = useState<Overlays>({ goals: [], cards: [] });

  // Refs: die Callbacks lesen den jeweils aktuellen Stand, ohne von ihm abzuhängen (sonst setzt jeder
  // Poll mit neuen Objekten das Intervall neu – C-MON-TAKT-STEHT).
  const stateRef = useRef(state);
  const mountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const againRef = useRef(false);
  const lastStartRef = useRef(Number.NEGATIVE_INFINITY);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef<string | null>(null);
  // F-324-Merker: Herkunft des letzten Erfolgs seit dem Ziel-Wechsel (wie früher dataSourceRef).
  const guardOriginRef = useRef<DisplayOrigin | null>(null);
  // Karten, die der Monitor schon kennt (null = noch kein Stand seit dem Ziel-Wechsel: nichts einblenden).
  const seenCardsRef = useRef<Set<string> | null>(null);
  const stampRef = useRef(0);

  const commit = useCallback((next: MonitorDisplayState) => {
    if (!mountedRef.current) { return; }
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (gapTimerRef.current !== null) { clearTimeout(gapTimerRef.current); }
    };
  }, []);

  // Neues Ziel: nur hasData und die Merker zurücksetzen. Turnier, Monitor und origin bleiben stehen,
  // bis die nächste Antwort kommt.
  useEffect(() => {
    versionRef.current = null;
    guardOriginRef.current = null;
    seenCardsRef.current = null;
    lastStartRef.current = Number.NEGATIVE_INFINITY; // neues Ziel lädt sofort (keine Drossel)
    setOverlays({ goals: [], cards: [] });
    if (stateRef.current.hasData) {
      commit({ ...stateRef.current, hasData: false });
    }
  }, [tournamentId, monitorId, commit]);

  /** Eindeutiger Zeitstempel je Einblendung (die Einblendungen erkennen Dopplungen daran). */
  const stamp = useCallback(() => {
    stampRef.current = Math.max(Date.now(), stampRef.current + 1);
    return stampRef.current;
  }, []);

  const noteOverlays = useCallback((prev: MonitorDisplayState, next: MonitorDisplayState) => {
    if (next === prev || next.tournament === null || next.monitor === null || !next.hasData) { return; }
    const seen = seenCardsRef.current;
    if (seen === null || !prev.hasData || prev.tournament?.id !== next.tournament.id) {
      // Erster Stand nach Laden/Ziel-Wechsel: nie einblenden, nur merken (Plan R5 Test 7).
      seenCardsRef.current = cardIdsOf(next.tournament);
      return;
    }
    const found = detectOverlays(prev.tournament, next.tournament, boundFieldNumbers(next.monitor.slides), seen, stamp);
    if (found.goals.length > 0 || found.cards.length > 0) {
      setOverlays((held) => ({ goals: [...held.goals, ...found.goals], cards: [...held.cards, ...found.cards] }));
    }
  }, [stamp]);

  const requestRef = useRef<() => void>(() => undefined);

  const loadData = useCallback(async () => {
    isFetchingRef.current = true;
    lastStartRef.current = Date.now();
    try {
      const delta = await source.fetch(versionRef.current);
      // B-19b (@ME-032): eine unlesbare Antwort ist eine neue, inkompatible Version → sofort neu laden.
      if (delta.kind === 'unreadable') { requestUrgentReload(); }
      if (delta.kind === 'snapshot') { versionRef.current = delta.version; }
      const prev = stateRef.current;
      const next = applyDelta(prev, delta, {
        tournamentId,
        monitorId,
        now: Date.now(),
        guardOrigin: guardOriginRef.current,
      });
      // Erfolg = neuer Stand ohne Fehler (Regel-Abweisungen liefern dieselbe Referenz oder setzen error).
      if (next !== prev && next.error === null) { guardOriginRef.current = next.origin; }
      if (mountedRef.current) { noteOverlays(prev, next); }
      commit(next);
    } catch (err) {
      commit(applyFetchError(stateRef.current, err));
    } finally {
      isFetchingRef.current = false;
      if (againRef.current && mountedRef.current) {
        againRef.current = false;
        requestRef.current();
      }
    }
  }, [source, tournamentId, monitorId, commit, noteOverlays]);

  /** Abruf anstoßen: sofort, oder nach dem laufenden (genau einmal), oder nach Ablauf der Mindest-Lücke. */
  const request = useCallback(() => {
    if (!mountedRef.current) { return; }
    if (isFetchingRef.current) {
      againRef.current = true;
      return;
    }
    const wait = lastStartRef.current + MIN_FETCH_GAP_MS - Date.now();
    if (wait > 0) {
      gapTimerRef.current ??= setTimeout(() => {
        gapTimerRef.current = null;
        requestRef.current();
      }, wait);
      return;
    }
    void loadData();
  }, [loadData]);
  requestRef.current = request;

  // Erst-Laden bei jedem neuen Ziel.
  useEffect(() => {
    request();
  }, [request]);

  // Änderungssignal der Quelle (Server-Kanal, im selben Browser die Engine).
  useEffect(() => source.subscribe?.(() => { requestRef.current(); }), [source]);

  // Fenster wieder sichtbar / Netz zurück → sofort abrufen (@ZM-123, Zone 1 „aus dem Hintergrund ≤ 3 s“).
  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') { requestRef.current(); }
    };
    const onOnline = (): void => { requestRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Rückfall-Takt. Auch ohne Monitor, damit ein Bildschirm, der vor dem WLAN startet, nachlädt.
  const pollIntervalMs = pollIntervalFor(state.monitor, state.origin);
  useEffect(() => {
    const interval = setInterval(() => { requestRef.current(); }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  const clearGoalEvent = useCallback(() => {
    setOverlays((held) => (held.goals.length === 0 ? held : { ...held, goals: held.goals.slice(1) }));
  }, []);
  const clearCardEvent = useCallback(() => {
    setOverlays((held) => (held.cards.length === 0 ? held : { ...held, cards: held.cards.slice(1) }));
  }, []);

  return {
    ...state,
    goalEvent: overlays.goals[0] ?? null,
    cardEvent: overlays.cards[0] ?? null,
    clearGoalEvent,
    clearCardEvent,
  };
}
