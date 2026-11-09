/**
 * Verbindungs-Wächter des Monitors (Paket M, @ME-030, @ZM-085, @ME-007).
 *
 * Eine „Antwort“ ist jede Rückmeldung des Servers, auch „unverändert“ (monitorDisplayState.istAntwort). Bleibt sie 30 Sekunden aus –
 * der Abruf hängt oder scheitert, obwohl der Browser Netz meldet –, steht `verbindung` mit der Serverzeit des letzten Stands
 * (daraus entsteht der Name des Symbols „Keine Verbindung seit hh:mm“); mit der nächsten Antwort ist sie wieder `null`. Ohne je einen
 * Stand gibt es sie nie (dort steht „Warte auf Verbindung“).
 * Die Frist läuft in Geräteuhr (`Date.now`, bewusst die Wanduhr: ein Ruhezustand zählt mit, `performance.now` zählt ihn je nach Browser nicht).
 * Die Wanduhr ist nicht monoton: stellt jemand sie zurück, kommt das Symbol später; stellt jemand sie vor, blitzt es bis zur nächsten
 * Antwort kurz auf. Der angezeigte Zeitpunkt ist Serverzeit (@ME-031).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** So lange ohne Antwort bleibt der Monitor still (ms) – @ME-030. */
export const VERBINDUNG_NACH_MS = 30_000;
/** Takt der Prüfung (ms); ein Zustandswechsel kostet nur beim Übergang einen Render. */
const PRUEF_TAKT_MS = 1_000;

/** Die Verbindung ist eingefroren; `standMs` = Serverzeit der letzten Antwort (ms). */
export interface MonitorVerbindung {
  standMs: number;
}

interface LetzteAntwort {
  geraeteMs: number;
  serverMs: number;
}

export function useMonitorVerbindung(): {
  verbindung: MonitorVerbindung | null;
  /** Der Server hat geantwortet; `serverMs` = Serverzeit dieser Antwort. */
  antwort: (serverMs: number) => void;
  /** Neues Ziel: die Frist beginnt neu. */
  zuruecksetzen: () => void;
} {
  const letzte = useRef<LetzteAntwort | null>(null);
  const [verbindung, setVerbindung] = useState<MonitorVerbindung | null>(null);

  const antwort = useCallback((serverMs: number) => {
    letzte.current = { geraeteMs: Date.now(), serverMs };
    setVerbindung(null);
  }, []);

  const zuruecksetzen = useCallback(() => {
    letzte.current = null;
    setVerbindung(null);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const last = letzte.current;
      if (last === null || Date.now() - last.geraeteMs < VERBINDUNG_NACH_MS) { return; }
      setVerbindung((aktuell) => (aktuell?.standMs === last.serverMs ? aktuell : { standMs: last.serverMs }));
    }, PRUEF_TAKT_MS);
    return () => clearInterval(timer);
  }, []);

  return { verbindung, antwort, zuruecksetzen };
}
