/**
 * useFoulThresholdWarning (C3b-2 F3a, M7): 5-Fouls-Warnung als Effekt auf den Wert aus
 * useFoulCounts – einmal je Team beim Uebergang auf >= 5 (auch wenn die 5. ein Karten-/
 * Zeitstrafen-Eintrag ist), bei 6/7 nicht erneut, Heim/Auswaerts getrennt.
 */
import { useEffect, useRef } from 'react';

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
  warn: (teamName: string) => void,
): void {
  const warned = useRef({ home: false, away: false });
  const warnRef = useRef(warn);
  warnRef.current = warn;

  useEffect(() => {
    if (counts.home >= 5 && !warned.current.home) {
      warned.current.home = true;
      warnRef.current(teamNames.home);
    }
    if (counts.away >= 5 && !warned.current.away) {
      warned.current.away = true;
      warnRef.current(teamNames.away);
    }
  }, [counts.home, counts.away, teamNames.home, teamNames.away]);
}
