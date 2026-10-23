import { useCallback, useState } from 'react';
import type { Side } from '../model/cockpitTypes';

export interface UseSideOrderReturn { getauscht: boolean; links: Side; rechts: Side; tausche: () => void }

/** @SL-065: lokaler Seitentausch, nur Anzeige dieses Geräts. Aufheben bei Heim/Gast-Tausch folgt in Aufgabe 3.7 (L7). */
export function useSideOrder(_match: { id: string; homeTeam: { id: string }; awayTeam: { id: string } } | null): UseSideOrderReturn {
  const [getauscht, setGetauscht] = useState(false);
  const tausche = useCallback(() => { setGetauscht((v) => !v); }, []);
  return { getauscht, links: getauscht ? 'away' : 'home', rechts: getauscht ? 'home' : 'away', tausche };
}
