/**
 * Farben der Ergebniskästen im Cockpit (Plan Cockpit v2 3.1, @SL-176): dieselben Kästen wie am Hallenmonitor (`MatchView.boxes`).
 * Eigene Datei, weil `types.ts` an der Zeilengrenze steht; `LiveCockpitLeisteProps` erbt sie.
 */
import type { MatchView } from '../../core/view';
import type { TrikotFarben } from '../../core/models/kitChoice';

/** Kästen je Seite des Spiels (`home`/`away`, nicht die Anzeigeseite); das Cockpit legt sie über `useSideOrder` auf links/rechts. */
export type CockpitKasten = MatchView['boxes'];

export interface LiveCockpitFarbenProps {
  /** Getragene Farben beider Seiten nach der Einstellung „Teamfarben in den Ergebniskästen“; ohne Angabe die Standardfarben. */
  kasten?: CockpitKasten;
  /**
   * Leibchen-Wahl vor dem Anpfiff (@SL-137, @SL-148, @SL-196): echte Trikotfarben (`a` = Heim, `b` = Gast) und die Leibchenfarbe des
   * Turniers. Ohne Angabe bietet die Anpfiff-Ansicht keine Wahl an.
   */
  leibchen?: CockpitLeibchen;
  /** Spielzeit aus den Turnierregeln für die Tafel vor dem Anpfiff (@SL-197); ohne Angabe steht dort die Anstoßzeit. */
  spielzeit?: { abschnitte: number; abschnittSekunden: number } | null;
}

export interface CockpitLeibchen {
  farben: TrikotFarben;
  turnierFarbe: string;
}
