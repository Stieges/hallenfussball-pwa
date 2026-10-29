/**
 * Typen der Tafel (`Scoreboard`, `ScoreboardDesktop`): Modell, Seiten, Uhr, Zeitbalken und Eigenschaften.
 * Ausgelagert, damit Handy-Tafel und Laptop-Tafel dieselben Typen teilen (Plan Cockpit v2 B1); `Scoreboard.tsx` führt sie weiter aus.
 */
import type { ReactNode } from 'react';
import type { SideBox } from '../../../core/models/scoreBoxColors';
import type { MatchBadgeModel } from '../../../core/view/badge';
import type { ZeitBalkenModell } from '../../../core/view/zeitBalken';

export interface ScoreboardSeite {
  name: string; tore: number;
  /** „Heim“ bzw. „Gast“: steht in der Stufe „knapp“ am Laptop statt des Namens über dem Kasten (Variante a, @SL-181). */
  label?: string;
  /** Kasten dieser Anzeigeseite: getragene Farbe wie am Hallenmonitor (@SL-176, `MatchView.boxes`); fehlt er, bleibt der Kasten neutral. */
  kasten?: SideBox;
}
/**
 * `schlussphase`: nur Uhr-Art „durchlaufend, letzte Minute angehalten“ in ihrer Schlussphase (@SL-003, @SL-136) → Uhr in
 * `scoreboardFinalPhase` (Violett). `ton`: gedämpft (Pause, Endstand) oder grün (Pause vorbei, Wiederanpfiff).
 */
/** Zeitbalken: Anteil (Rest durch Länge) und Ton – Regel und Typ in `core/view/zeitBalken` (eine Quelle mit dem Hallenmonitor, @ZM-166). */
export type ScoreboardBalken = ZeitBalkenModell;
export interface ScoreboardUhr {
  rest: string; gespielt: string | null; hervorgehoben: boolean; steht: boolean; schlussphase: boolean;
  /** Zeitbalken unter der Uhr (Laptop, @SL-180); fehlt er, steht keiner. */
  balken?: ScoreboardBalken | null;
  /** Zeile über der Uhr („Restzeit“, „angehalten“, „Pause“, „Anstoß“). */
  label?: string | null;
  /** Zeile unter der Uhr („Spielzeit 3:12“); fehlt sie, steht `gespielt`. */
  unterzeile?: string | null;
  ton?: 'gedaempft' | 'ok';
}
export interface ScoreboardModel {
  /** Zustands-Abzeichen ohne Uhr (@OB-065, @OB-066): dasselbe Molekül wie die Spielkarte. */
  badge: MatchBadgeModel;
  /** Vor dem Anpfiff nach der Anstoßzeit: „überfällig N Min“ im selben Platz (@OB-068); sonst leer. */
  ueberfaelligText?: string | null;
  /** Nach dem Abpfiff 30 Sekunden lang: „Abgepfiffen · 2:1 gespeichert“ unter dem Endstand (@SL-152); sonst leer. */
  quittungText?: string | null;
  links: ScoreboardSeite; rechts: ScoreboardSeite;
  uhr: ScoreboardUhr | null;
  /** Text in der Kopfzeile neben dem Zustand: Abschnitt, vor dem Spiel der Turniername. */
  abschnittText: string | null;
  /** Kopfzeile am Laptop (@SL-180): „Spiel 3 · Feld 1 · 2. Halbzeit · Gespielt 4:06“; Teile ohne Wert entfallen. */
  kopfText?: string | null;
  hinweise: string[];
  eintraegeWartenText: string | null;
  /** Nur die Zahl: steht statt des vollen Wortlauts, wenn neben dem Zustand auch das Ton-Abzeichen Platz braucht (C-TAFEL-TON-UND-WARTEND-BRECHEN-ZEILE). */
  eintraegeWartenKurz?: string | null;
  helferAnfragenText: string | null;
  ariaStand: string;
  /** Statt Stand und Uhr: „wartet auf Teams“ und „kein Spiel mehr“ (Aufgabe 2.5). */
  leerAnzeige?: { titel: string; untertitel: string | null } | null;
}
/** `label` ist der zugängliche Name; `kurz` der sichtbare Text (fehlt er, steht `label`). */
export interface ScoreboardAbzeichenKnopf { label: string; kurz?: string; onAntippen: () => void }
export interface ScoreboardProps {
  model: ScoreboardModel;
  size: 'compact' | 'regular' | 'wide';
  /** Stufe der Fensterhöhe am Laptop (Maße von Kasten und Ziffern, @SL-187); ohne Angabe die Handy-Maße. */
  stufe?: 'knapp' | 'normal' | 'gross';
  meldezeile: ReactNode;
  onHelferAnfragen?: () => void;
  testId?: string;
  /** Stehende Anzeige (Spec § 7 Nr. 1): Wachhalten-Symbol, bis es angetippt wird (Aufgabe 4.2). */
  wachhaltenHinweis?: ScoreboardAbzeichenKnopf | null;
  /** Der Ton für den Abpfiff ist (noch) nicht freigegeben: Abzeichen statt schwebendem Hinweis (C-COCKPIT-SOUNDHINWEIS-VERDECKT). */
  tonHinweis?: ScoreboardAbzeichenKnopf | null;
  /** Übergang bis zum schmalen Kopf (Aufgabe 3.8): Verbindungsanzeige in der Kopfzeile. */
  kopfRechts?: ReactNode;
}
