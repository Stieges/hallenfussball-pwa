/**
 * Sekundentakt für laufende Spiele: liefert die aktuelle Zeit in ms und aktualisiert sie jede Sekunde,
 * solange `active` gilt. Ohne laufendes Spiel gibt es keinen Takt.
 */
import { useEffect, useMemo, useState } from 'react';
import type { TournamentView } from '../../core/view';
import type { Match } from '../../types/tournament';
import { cachedElapsedSeconds } from './matchResult';

const TICK_MS = 1000;

export function useTickingNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Spielzeit laufender Spiele für die Kopfzeile der Karte (@OB-064): ein Sekundentakt, solange ein Spiel der Ansicht läuft.
 * `custom` (z. B. die Uhr der Engine in der Verwaltung) hat Vorrang; sonst die Zeitfelder des Spiels im Zwischenspeicher.
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
    () => custom ?? ((matchId: string) => cachedElapsedSeconds(byId.get(matchId), nowMs)),
    [custom, byId, nowMs],
  );
}
