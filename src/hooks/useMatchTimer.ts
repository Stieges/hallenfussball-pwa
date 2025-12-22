/**
 * useMatchTimer Hook
 *
 * Custom Hook für präzise Timer-Anzeige ohne State-Kaskaden.
 * Verwendet requestAnimationFrame für flüssige Updates.
 *
 * MF-002: Performance-Optimierung - Timer wird lokal berechnet
 * statt über globale State-Updates.
 */

import { useState, useEffect, useRef } from 'react';

type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

/**
 * Hook für lokale Timer-Berechnung basierend auf timerStartTime
 *
 * @param timerStartTime - ISO-Timestamp wann der Timer gestartet wurde
 * @param baseElapsedSeconds - Bereits vergangene Sekunden vor dem aktuellen Timer-Start
 * @param status - Aktueller Match-Status
 * @returns Aktuelle verstrichene Sekunden für die Anzeige
 */
export function useMatchTimer(
  timerStartTime: string | null | undefined,
  baseElapsedSeconds: number,
  status: MatchStatus
): number {
  const [displayTime, setDisplayTime] = useState(baseElapsedSeconds);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Wenn nicht RUNNING, zeige die gespeicherte Zeit
    if (status !== 'RUNNING' || !timerStartTime) {
      setDisplayTime(baseElapsedSeconds);
      return;
    }

    const startTime = new Date(timerStartTime).getTime();
    let animationFrameId: number;

    const updateTimer = () => {
      const now = Date.now();

      // Nur jede Sekunde aktualisieren (Performance)
      const currentSecond = Math.floor(now / 1000);
      if (currentSecond !== lastUpdateRef.current) {
        lastUpdateRef.current = currentSecond;

        const runtimeMs = now - startTime;
        const runtimeSeconds = Math.floor(runtimeMs / 1000);
        const totalElapsed = baseElapsedSeconds + runtimeSeconds;

        setDisplayTime(totalElapsed);
      }

      animationFrameId = requestAnimationFrame(updateTimer);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [timerStartTime, baseElapsedSeconds, status]);

  return displayTime;
}
