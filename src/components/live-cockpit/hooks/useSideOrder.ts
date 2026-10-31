import { useCallback, useState } from 'react';
import type { Side } from '../model/cockpitTypes';

export interface UseSideOrderReturn { getauscht: boolean; links: Side; rechts: Side; tausche: () => void }

/**
 * @SL-065: lokaler Seitentausch, nur Anzeige dieses Geräts. Er gehört zu dem Spiel und der Paarung, in der er gewählt wurde:
 * Das Cockpit bleibt beim Spielwechsel eingebunden, darum fällt der Tausch weg, sobald ein anderes Spiel gezeigt wird
 * (C-SEITENTAUSCH-WIRKT-AUFS-NAECHSTE-SPIEL) und auch, wenn die Turnierleitung Heim und Gast tauscht (@SL-127, Grundstellung).
 */
export function useSideOrder(match: { id: string; homeTeam: { id: string }; awayTeam: { id: string } } | null): UseSideOrderReturn {
  const paarung = match === null ? '' : `${match.id}|${match.homeTeam.id}|${match.awayTeam.id}`;
  const [tausch, setTausch] = useState<{ paarung: string; getauscht: boolean }>({ paarung, getauscht: false });
  // Anpassung während des Zeichnens (React-Muster „State aus Props zurücksetzen“): kein Zwischenbild mit vertauschten Seiten
  if (tausch.paarung !== paarung) {
    setTausch({ paarung, getauscht: false });
  }
  const getauscht = tausch.paarung === paarung && tausch.getauscht;
  const tausche = useCallback(() => { setTausch((v) => ({ paarung, getauscht: v.paarung === paarung ? !v.getauscht : true })); }, [paarung]);
  return { getauscht, links: getauscht ? 'away' : 'home', rechts: getauscht ? 'home' : 'away', tausche };
}
