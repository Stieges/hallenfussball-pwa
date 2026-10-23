/**
 * useFoulThresholdWarning (C3b-2 F3a, M7; Cockpit 2.3, @SL-034/@SL-098): Warnung als Effekt auf den
 * Wert aus useFoulCounts – bei jedem weiteren Foul ab der Grenze (auch wenn es ein Karten-/
 * Zeitstrafen-Eintrag ist), mit der Nummer des Fouls, Heim/Auswaerts getrennt. Ein Spiel, das schon
 * mit Fouls ueber der Grenze geoeffnet wird, meldet nichts: nur ein neues Foul meldet. Wird ein Foul
 * zurueckgenommen oder wechselt das Spiel (`matchId`), merkt sich der Hook den niedrigeren Stand und meldet das naechste wieder.
 * Grenze fest 5 und Zaehler fuers ganze Spiel bis B-11a (Regel `foulLimit`, Halbzeit-Zaehler).
 */
import { useEffect, useRef } from 'react';

export const FOUL_WARNING_THRESHOLD = 5;

export interface FoulThresholdCounts {
  home: number;
  away: number;
}

export interface FoulThresholdNames {
  home: string;
  away: string;
}

export function useFoulThresholdWarning(
  counts: FoulThresholdCounts,
  teamNames: FoulThresholdNames,
  warn: (teamName: string, count: number) => void,
  matchId?: string,
): void {
  const last = useRef({ home: counts.home, away: counts.away });
  const lastMatchId = useRef(matchId);
  const warnRef = useRef(warn);
  warnRef.current = warn;

  useEffect(() => {
    const names = { home: teamNames.home, away: teamNames.away };
    const now = { home: counts.home, away: counts.away };
    if (lastMatchId.current !== matchId) {
      // Anderes Spiel: Stand übernehmen, nichts melden (nur ein neues Foul dort meldet).
      lastMatchId.current = matchId;
      last.current = now;
      return;
    }
    for (const side of ['home', 'away'] as const) {
      if (now[side] > last.current[side] && now[side] >= FOUL_WARNING_THRESHOLD) {
        warnRef.current(names[side], now[side]);
      }
      last.current[side] = now[side];
    }
  }, [counts.home, counts.away, teamNames.home, teamNames.away, matchId]);
}
