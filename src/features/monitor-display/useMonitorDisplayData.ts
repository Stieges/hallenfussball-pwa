/**
 * Lade- und Poll-Hook des Monitors (B-16b2).
 *
 * Abruf: monitorDataSource.ts · Zustandsregeln: monitorDisplayState.ts · dieser Hook: Takt, Ziel-Wechsel,
 * Schutz gegen parallele Abrufe, Aufräumen beim Unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TournamentMonitor } from '../../types/monitor';
import type { DisplayOrigin, MonitorDataSource } from './monitorDataSource';
import { requestUrgentReload } from '../../lib/swRegistration';
import {
  applyDelta,
  applyFetchError,
  initialDisplayState,
  type MonitorDisplayState,
} from './monitorDisplayState';

export interface MonitorDisplayTarget {
  tournamentId: string;
  monitorId: string;
}

/**
 * @param pollIntervalFor Takt in ms: abhängig vom geladenen Monitor (ohne Monitor 5000 ms, sonst Profil).
 */
export function useMonitorDisplayData(
  source: MonitorDataSource,
  target: MonitorDisplayTarget,
  pollIntervalFor: (monitor: TournamentMonitor | null) => number
): MonitorDisplayState {
  const { tournamentId, monitorId } = target;
  const [state, setState] = useState<MonitorDisplayState>(() => ({
    ...initialDisplayState,
    lastFetch: Date.now(),
  }));

  // Refs: die Callbacks lesen den jeweils aktuellen Stand, ohne von ihm abzuhängen (sonst setzt jeder
  // Poll mit neuen Objekten das Intervall neu – C-MON-TAKT-STEHT).
  const stateRef = useRef(state);
  const mountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const versionRef = useRef<string | null>(null);
  // F-324-Merker: Herkunft des letzten Erfolgs seit dem Ziel-Wechsel (wie früher dataSourceRef).
  const guardOriginRef = useRef<DisplayOrigin | null>(null);

  const commit = useCallback((next: MonitorDisplayState) => {
    if (!mountedRef.current) { return; }
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Neues Ziel: nur hasData und die Merker zurücksetzen. Turnier, Monitor und origin bleiben stehen,
  // bis die nächste Antwort kommt (ein Reset auf den Ausgangszustand würde die Realtime-Anbindung abmelden).
  useEffect(() => {
    versionRef.current = null;
    guardOriginRef.current = null;
    if (stateRef.current.hasData) {
      commit({ ...stateRef.current, hasData: false });
    }
  }, [tournamentId, monitorId, commit]);

  const loadData = useCallback(async () => {
    // Kein zweiter Abruf, solange der erste läuft (Race-Schutz).
    if (isFetchingRef.current) { return; }
    isFetchingRef.current = true;
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
      commit(next);
    } catch (err) {
      commit(applyFetchError(stateRef.current, err));
    } finally {
      isFetchingRef.current = false;
    }
  }, [source, tournamentId, monitorId, commit]);

  // Erst-Laden bei jedem neuen Ziel.
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Poll. Auch ohne Monitor, damit ein Bildschirm, der vor dem WLAN startet, nachlädt.
  const pollIntervalMs = pollIntervalFor(state.monitor);
  useEffect(() => {
    const interval = setInterval(() => { void loadData(); }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [loadData, pollIntervalMs]);

  return state;
}
