import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { captureFeatureError } from '../../lib/sentry';
import type { WakeLockStatus } from '../../hooks/useWakeLock';
import { istBrowserQuelle } from './monitorDauerbetrieb';
import { wakeLockReport, type WakeLockReport } from './monitorHeartbeatReport';

/** Takt des Lebenszeichens (@ME-064: „meldet seinen Zustand alle 30 Sekunden“). */
export const HEARTBEAT_INTERVAL_MS = 30_000;

interface HeartbeatArgs {
  /** Kennung des Monitors aus `tournaments.config.monitors` (`mon-…`), als Text (B-48b, Befund C-HEARTBEAT) */
  p_monitor_key: string;
  p_tournament_id: string;
  p_slide_index: number;
  p_cache_status: string;
  p_user_agent: string;
  p_wake_lock: WakeLockReport | null;
}

/**
 * `src/types/supabase.ts` kennt die neue Signatur (`20261113_101_monitor_heartbeat_wake_lock.sql`) erst nach dem
 * Typen-PR nach dem DB-Fenster – deshalb ohne Typbindung (Muster `resetMatchResultsRpc.ts`).
 */
type HeartbeatRpc = (
  fn: 'record_monitor_heartbeat',
  args: HeartbeatArgs,
) => PromiseLike<{ error: { message: string } | null }>;

interface HeartbeatWerte {
  slideIndex: number;
  cacheStatusKey: string;
  report: WakeLockReport | null;
}

/**
 * Lebenszeichen des Monitors (B-16d2, B-48b): alle 30 s und sofort, wenn sich der gemeldete Wachhalten-Zustand ändert,
 * damit die Verwaltung „verbunden“, „zuletzt gesehen“ und „Wachhalten: …“ zeigen kann (@ME-026, @ME-027, @ME-064).
 * Der Takt hängt nur an Monitor und Turnier: Folienwechsel, neue Poll-Objekte und Zustandswechsel starten ihn nicht neu
 * (C-MON-HEARTBEAT-JE-POLL, C-MON-HEARTBEAT-TAKT). Ein Fehler ist am Monitor nie sichtbar; er wird einmal je
 * Seitenaufruf gemeldet, gesendet wird im Takt weiter.
 */
export function useMonitorHeartbeat(
  monitorKey: string | null,
  tournamentKey: string | null,
  slideIndex: number,
  cacheStatusKey: string,
  wakeLockStatus: WakeLockStatus,
): void {
  // Nachtrag 17.10.: „einmal zugesagt“ merkt sich der Melde-Hook selbst (abgeleiteter Zustand, kein Effekt nötig).
  const [warZugesagt, setWarZugesagt] = useState(false);
  if (wakeLockStatus === 'granted' && !warZugesagt) {
    setWarZugesagt(true);
  }
  const report = wakeLockReport(wakeLockStatus, {
    browserQuelle: istBrowserQuelle(window.location.hash, navigator.userAgent),
    warZugesagt: warZugesagt || wakeLockStatus === 'granted',
  });

  const latest = useRef<HeartbeatWerte>({ slideIndex, cacheStatusKey, report });
  /** Zuletzt gesendete Meldung; `undefined`, solange kein Takt läuft. */
  const gesendet = useRef<WakeLockReport | null | undefined>(undefined);
  const fehlerGemeldet = useRef(false);

  useEffect(() => {
    latest.current = { slideIndex, cacheStatusKey, report };
  });

  useEffect(() => {
    if (!monitorKey || !tournamentKey) {
      return undefined;
    }
    const senden = (): void => {
      gesendet.current = latest.current.report;
      void sendeLebenszeichen(monitorKey, tournamentKey, latest.current, fehlerGemeldet);
    };
    senden();
    const takt = setInterval(senden, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(takt);
      gesendet.current = undefined;
    };
  }, [monitorKey, tournamentKey]);

  // Zustandswechsel sofort melden, nicht erst im nächsten Takt (brief-B-48.md Schritt 3)
  useEffect(() => {
    if (!monitorKey || !tournamentKey || gesendet.current === undefined || gesendet.current === report) {
      return;
    }
    gesendet.current = report;
    void sendeLebenszeichen(monitorKey, tournamentKey, latest.current, fehlerGemeldet);
  }, [report, monitorKey, tournamentKey]);
}

async function sendeLebenszeichen(
  monitorKey: string,
  tournamentKey: string,
  werte: HeartbeatWerte,
  fehlerGemeldet: { current: boolean },
): Promise<void> {
  if (!supabase) {
    return;
  }
  const rpc = supabase.rpc.bind(supabase) as unknown as HeartbeatRpc;
  let meldung: string | null;
  try {
    const { error } = await rpc('record_monitor_heartbeat', {
      p_monitor_key: monitorKey,
      p_tournament_id: tournamentKey,
      p_slide_index: werte.slideIndex,
      p_cache_status: werte.cacheStatusKey,
      p_user_agent: navigator.userAgent,
      p_wake_lock: werte.report,
    });
    meldung = error ? error.message : null;
  } catch (err) {
    meldung = err instanceof Error ? err.message : 'unbekannt';
  }
  if (meldung !== null && !fehlerGemeldet.current) {
    // supabase-js wirft bei PG-Fehlern nicht — einmal pro Seitenaufruf signalisieren,
    // sonst bleibt ein kaputter Heartbeat-Pfad wieder monatelang unsichtbar.
    fehlerGemeldet.current = true;
    captureFeatureError(new Error(`heartbeat failed: ${meldung}`), 'monitor', 'heartbeat');
  }
}
