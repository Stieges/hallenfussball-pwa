/**
 * Sekundentakt für laufende Spiele: liefert die aktuelle Zeit in ms und aktualisiert sie jede Sekunde,
 * solange `active` gilt. Ohne laufendes Spiel gibt es keinen Takt.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { TournamentView } from '../../core/view';
import type { Match } from '../../types/tournament';
import { cachedElapsedSeconds } from './matchResult';

const TICK_MS = 1000;

/**
 * Jetzt in Serverzeit (ms): die Zuschauer-Seite stellt hier den Abstand zum Server bereit (B-15, @ZM-026), damit die Restzeit
 * nicht von der Uhr des Handys abhängt. Ohne Bereitsteller gilt die Geräteuhr.
 */
export const NowSourceContext = createContext<() => number>(() => Date.now());

/**
 * Sekundentakt für laufende Spiele. `serverTime`: die Zeit kommt vom Bereitsteller des Kontexts (Serverzeit) statt von der
 * Geräteuhr – nur dort, wo gegen Zeitpunkte in Serverzeit gerechnet wird (Feinstatus `live_state`).
 */
export function useTickingNow(active: boolean, serverTime = false): number {
  const serverNow = useContext(NowSourceContext);
  const read = serverTime ? serverNow : Date.now;
  const [now, setNow] = useState(() => read());
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    setNow(read());
    const timer = setInterval(() => setNow(read()), TICK_MS);
    return () => clearInterval(timer);
  }, [active, read]);
  return now;
}

/**
 * Spielzeit laufender Spiele für die Kopfzeile der Karte (@OB-064): ein Sekundentakt, solange ein Spiel der Ansicht läuft.
 * `custom` (z. B. die Uhr der Engine in der Verwaltung) hat Vorrang; kennt sie das Spiel nicht, gelten die Zeitfelder des Spiels im Zwischenspeicher.
 */
export function useElapsedSeconds(
  view: TournamentView | undefined,
  currentMatches: readonly Match[] | undefined,
  custom: ((matchId: string) => number | undefined) | undefined,
): (matchId: string) => number | undefined {
  const nowMs = useTickingNow((view?.current.live.length ?? 0) > 0);
  const byId = useMemo(() => new Map((currentMatches ?? []).map((m) => [m.id, m])), [currentMatches]);
  // nowMs gehört in die Abhängigkeiten: jeder Takt liefert neue Zeiten
  return useMemo(
    () => (matchId: string) => custom?.(matchId) ?? cachedElapsedSeconds(byId.get(matchId), nowMs),
    [custom, byId, nowMs],
  );
}
