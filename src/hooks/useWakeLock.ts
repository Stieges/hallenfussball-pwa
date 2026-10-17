/**
 * useWakeLock Hook
 *
 * Verwaltet die Zusage des Geräts, den Bildschirm anzulassen (Screen Wake Lock API), und liefert ihren Zustand
 * (B-48a, @ME-006, @ME-064, @SL-122). Fordert nach der Rückkehr in den Vordergrund neu an.
 *
 * Kein Zustand blockiert die Seite: Ausnahmen der Schnittstelle werden gefangen und als `denied` gewertet.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md Section 3.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { captureFeatureError } from '../lib/sentry';

/** So lange darf die Anfrage unbeantwortet bleiben, bevor der Zustand `noAnswer` gilt (LG webOS, @ME-006 Lage 2). */
export const WAKE_LOCK_ANSWER_TIMEOUT_MS = 5000;

/**
 * Zustand der Zusage.
 * - `idle`: nicht angefordert
 * - `pending`: Anfrage läuft, noch keine Antwort
 * - `granted`: zugesagt
 * - `denied`: abgelehnt (oder Ausnahme der Schnittstelle)
 * - `unsupported`: die Schnittstelle fehlt
 * - `noAnswer`: 5 s weder Ja noch Nein; eine spätere Antwort wechselt auf `granted`/`denied`
 * - `released`: nach einer Zusage wieder freigegeben (Tab im Hintergrund, Akku)
 */
export type WakeLockStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported' | 'noAnswer' | 'released';

/** Return type for useWakeLock */
export interface UseWakeLockReturn {
  /** Zustand der Zusage */
  status: WakeLockStatus;
  /** Whether the browser supports Wake Lock API */
  isSupported: boolean;
  /** Request wake lock */
  request: () => Promise<void>;
  /** Release wake lock */
  release: () => Promise<void>;
}

/**
 * Hook for managing screen wake lock
 *
 * @param enabled - Whether wake lock should be active
 */
export function useWakeLock(enabled: boolean): UseWakeLockReturn {
  const [status, setStatus] = useState<WakeLockStatus>('idle');

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const releaseHandlerRef = useRef<(() => void) | null>(null);
  const aktiv = useRef(true);
  const anfrageNr = useRef(0);
  const laeuft = useRef(false);
  const fehlerGemeldet = useRef(false);

  const isSupported = 'wakeLock' in navigator;

  const cleanupEventListener = useCallback(() => {
    if (wakeLockRef.current && releaseHandlerRef.current) {
      wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
      releaseHandlerRef.current = null;
    }
  }, []);

  const request = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    const nr = ++anfrageNr.current;
    laeuft.current = true;
    setStatus('pending');
    const timer = setTimeout(() => {
      if (aktiv.current && nr === anfrageNr.current) { setStatus('noAnswer'); }
    }, WAKE_LOCK_ANSWER_TIMEOUT_MS);

    try {
      cleanupEventListener();
      const lock = await navigator.wakeLock.request('screen');
      clearTimeout(timer);
      if (!aktiv.current || nr !== anfrageNr.current) {
        void lock.release().catch(() => undefined);
        return;
      }
      laeuft.current = false;
      wakeLockRef.current = lock;
      releaseHandlerRef.current = () => {
        // Ohne dieses Zurücksetzen hielte der visibilitychange-Handler das freigegebene Lock für aktiv.
        wakeLockRef.current = null;
        if (aktiv.current) { setStatus('released'); }
      };
      lock.addEventListener('release', releaseHandlerRef.current);
      setStatus('granted');
    } catch (err) {
      clearTimeout(timer);
      if (!aktiv.current || nr !== anfrageNr.current) { return; }
      laeuft.current = false;
      setStatus('denied');
      if (!fehlerGemeldet.current) {
        fehlerGemeldet.current = true;
        captureFeatureError(err instanceof Error ? err : new Error('wake lock denied'), 'wakeLock', 'request');
      }
    }
  }, [isSupported, cleanupEventListener]);

  const release = useCallback(async () => {
    anfrageNr.current++;
    laeuft.current = false;
    const lock = wakeLockRef.current;
    if (!lock) { return; }
    cleanupEventListener();
    wakeLockRef.current = null;
    try {
      await lock.release();
    } catch {
      // Eine fehlgeschlagene Freigabe ändert nichts: das Gerät hat die Zusage dann schon verloren.
    }
  }, [cleanupEventListener]);

  // Anfordern, solange `enabled`; bei Rücknahme freigeben
  useEffect(() => {
    if (enabled) {
      if (status === 'idle') { void request(); }
    } else if (status !== 'idle') {
      void release();
      setStatus('idle');
    }
  }, [enabled, status, request, release]);

  // Rückkehr in den Vordergrund: neue Anfrage, wenn keine Zusage steht und keine Anfrage läuft
  useEffect(() => {
    if (!enabled || !isSupported) { return undefined; }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current && !laeuft.current) {
        void request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isSupported, request]);

  // Aufräumen beim Abbau
  useEffect(() => {
    aktiv.current = true;
    return () => {
      aktiv.current = false;
      if (wakeLockRef.current && releaseHandlerRef.current) {
        wakeLockRef.current.removeEventListener('release', releaseHandlerRef.current);
      }
      if (wakeLockRef.current) { void wakeLockRef.current.release().catch(() => undefined); }
    };
  }, []);

  return { status, isSupported, request, release };
}
