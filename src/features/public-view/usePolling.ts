/**
 * usePolling – regelmäßiger Abruf im Vordergrund (B-15, @ZM-021, @ZM-029, @ZM-030, @ZM-031, @ZM-037).
 * Gemeinsam nutzbar (Monitor, B-18).
 *
 * - Im Vordergrund alle `intervalMs`; im Hintergrund (Tab verdeckt, Handy gesperrt, andere App) gar nicht: der Takt wird
 *   angehalten, nicht nur übersprungen.
 * - Kommt die Seite zurück in den Vordergrund, kommt das Netz zurück oder wird sie aus dem Zwischenspeicher des Browsers
 *   geholt, wird sofort einmal abgerufen und der Takt neu gestartet – der aktuelle Stand steht nach höchstens einem Takt da.
 * - Nie zwei Abrufe zugleich: läuft noch einer, gilt dessen Ergebnis.
 */
import { useCallback, useEffect, useRef } from 'react';

export interface UsePollingOptions {
  /** Ein Abruf. Fehler fängt der Aufrufer; was hier geworfen wird, wird verschluckt, damit der Takt weiterläuft. */
  task: () => Promise<void>;
  intervalMs: number;
  /** Aus: kein Abruf und kein Takt */
  enabled?: boolean;
}

export interface PollingControls {
  /** Sofort abrufen (z. B. Herunterziehen); läuft schon ein Abruf, wartet der Aufruf auf diesen. */
  pollNow: () => Promise<void>;
}

const isVisible = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function usePolling({ task, intervalMs, enabled = true }: UsePollingOptions): PollingControls {
  const taskRef = useRef(task);
  taskRef.current = task;
  const inFlightRef = useRef<Promise<void> | null>(null);

  const pollNow = useCallback((): Promise<void> => {
    if (inFlightRef.current !== null) {
      return inFlightRef.current;
    }
    const run = (async (): Promise<void> => {
      try {
        await taskRef.current();
      } catch {
        // Der Aufrufer meldet Fehler selbst; der Takt läuft weiter.
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = (): void => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = (): void => {
      stop();
      if (isVisible()) {
        timer = setInterval(() => { void pollNow(); }, intervalMs);
      }
    };
    const pollAndRestart = (): void => {
      if (isVisible()) {
        void pollNow();
        start();
      }
    };
    const onVisibility = (): void => {
      if (isVisible()) {
        pollAndRestart();
      } else {
        stop();
      }
    };
    const onPageShow = (event: Event): void => {
      if ((event as PageTransitionEvent).persisted) {
        pollAndRestart();
      }
    };

    pollAndRestart();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', pollAndRestart);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', pollAndRestart);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled, intervalMs, pollNow]);

  return { pollNow };
}
