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
}
