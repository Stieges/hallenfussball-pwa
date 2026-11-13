/**
 * Farben der Ergebniskästen im Cockpit (Plan Cockpit v2 3.1, @SL-176): dieselben Kästen wie am Hallenmonitor (`MatchView.boxes`).
 * Eigene Datei, weil `types.ts` an der Zeilengrenze steht; `LiveCockpitLeisteProps` erbt sie.
 */
import type { MatchView } from '../../core/view';

/** Kästen je Seite des Spiels (`home`/`away`, nicht die Anzeigeseite); das Cockpit legt sie über `useSideOrder` auf links/rechts. */
export type CockpitKasten = MatchView['boxes'];

export interface LiveCockpitFarbenProps {
  /** Getragene Farben beider Seiten nach der Einstellung „Teamfarben in den Ergebniskästen“; ohne Angabe die Standardfarben. */
  kasten?: CockpitKasten;
  /**
   * Das Turnier (mit der lokalen Wahl der Leibchen darüber) und die Epoche der Feldsteuerung für die Leibchen-Karte (@SL-206, @SL-215, @SL-202).
   * Ohne Angabe gibt es keine Karte.
   */
  leibchenTurnier?: { tournament: import('../../types/tournament').Tournament; epoche?: number | null };
  /** Spielzeit aus den Turnierregeln für die Tafel vor dem Anpfiff (@SL-197); ohne Angabe steht dort die Anstoßzeit. */
  spielzeit?: { abschnitte: number; abschnittSekunden: number } | null;
}
