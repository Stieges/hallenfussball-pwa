/**
 * Zugangsstatus des Helfer-Geräts im Turnier, alle 2 s abgefragt (R-GA5-6; @HE-055 „binnen 3 Sekunden“, @HE-001, @OB-053).
 *
 * - Nur bei sichtbarer Seite: eine ausgeblendete Seite fragt nicht (Egress, R10); beim Zurückkehren sofort eine Abfrage.
 * - Nie überlappend: die nächste Abfrage wird erst nach der Antwort geplant.
 * - Endzustände (entzogen, abgelehnt, abgeschlossen …) beenden die Abfrage.
 * - Netzfehler und Unerwartetes ändern den Stand nicht (kein Flackern, @HE-056 gehört der Klärungsliste), die Abfrage geht weiter.
 * - Jede Antwort führt den Zugangs-Index nach (`syncHelperAccessEntry`), damit der Wiedereinstieg den neuen Stand kennt.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { callHelperAccessStatus, type HelperAccessStatus, type HelperAccessView, type HelperRpcResult } from '../../core/repositories/helperAccessRpc';
import { supabase } from '../../lib/supabase';
import { syncHelperAccessEntry } from './helperAccessStore';
import { isTerminalOutcome, outcomeFromView, viewFromStatus, type HelperAccessOutcome } from './helperAccessOutcome';

/** Abfragetakt: höchstens 3 s bis zur Anzeige (@HE-055) bei 2 s Takt plus Antwortzeit. */
export const HELPER_STATUS_INTERVAL_MS = 2000;

export interface HelperStatusDeps {
  fetchStatus(tournamentId: string): Promise<HelperRpcResult<HelperAccessStatus>>;
  /** Index nachführen (nur mit Geräte-Sitzung). */
  onStatus?(tournamentId: string, info: HelperAccessStatus): void;
  isVisible(): boolean;
  /** Meldet, wenn die Seite sichtbar wird; gibt die Abmeldung zurück. */
  onBecameVisible(listener: () => void): () => void;
}

export interface UseHelperAccessStatusOptions {
  /** `false`: keine Abfrage (Konto, kein Helfer-Eintrag auf dem Gerät). */
  enabled?: boolean;
  /** Geräte-Nutzer-ID für das Nachführen des Index. */
  deviceUserId?: string | null;
  /** Start-Stand (aus dem Index), bis die erste Antwort da ist. */
  initial?: HelperAccessOutcome | null;
  intervalMs?: number;
  deps?: HelperStatusDeps;
}

export interface HelperAccessStatusResult {
  outcome: HelperAccessOutcome | null;
  /** Anzeige-Zuordnung der letzten Antwort; `null`, solange keine Antwort da ist. */
  view: HelperAccessView | null;
  info: HelperAccessStatus | null;
}

function documentDeps(): Pick<HelperStatusDeps, 'isVisible' | 'onBecameVisible'> {
  return {
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onBecameVisible: (listener) => {
      const handler = () => { if (document.visibilityState !== 'hidden') { listener(); } };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
  };
}

export function useHelperAccessStatus(tournamentId: string | null, options: UseHelperAccessStatusOptions = {}): HelperAccessStatusResult {
  const { enabled = true, deviceUserId = null, initial = null, intervalMs = HELPER_STATUS_INTERVAL_MS, deps: injected } = options;
  const [result, setResult] = useState<HelperAccessStatusResult>({ outcome: initial, view: null, info: null });
  const userRef = useRef(deviceUserId);
  useEffect(() => { userRef.current = deviceUserId; }, [deviceUserId]);

  const deps = useMemo<HelperStatusDeps>(
    () =>
      injected ?? {
        ...documentDeps(),
        fetchStatus: (id) => callHelperAccessStatus(supabase, id),
        onStatus: (id, info) => {
          if (userRef.current) {
            syncHelperAccessEntry(userRef.current, id, info, null);
          }
        },
      },
    [injected],
  );

  useEffect(() => {
    if (!enabled || !tournamentId) {
      return undefined;
    }
    let cancelled = false;
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(() => { void tick(); }, intervalMs);
    };
    const tick = async (): Promise<void> => {
      timer = null;
      if (cancelled || stopped || inFlight || !deps.isVisible()) {
        return; // unsichtbar: kein Neuplanen, `onBecameVisible` weckt die Abfrage wieder
      }
      inFlight = true;
      let response: HelperRpcResult<HelperAccessStatus>;
      try {
        response = await deps.fetchStatus(tournamentId);
      } catch {
        response = { ok: false, error: { kind: 'network' } };
      }
      inFlight = false;
      if (cancelled) {
        return;
      }
      if (response.ok) {
        deps.onStatus?.(tournamentId, response.data);
        const view = viewFromStatus(response.data);
        const outcome = outcomeFromView(view);
        setResult({ outcome, view, info: response.data });
        if (isTerminalOutcome(outcome)) {
          stopped = true;
          return;
        }
      }
      schedule();
    };

    void tick();
    const stopListening = deps.onBecameVisible(() => {
      if (!cancelled && !stopped && !inFlight) {
        if (timer) { clearTimeout(timer); }
        void tick();
      }
    });
    return () => {
      cancelled = true;
      if (timer) { clearTimeout(timer); }
      stopListening();
    };
  }, [enabled, tournamentId, intervalMs, deps]);

  return result;
}
