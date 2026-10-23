/**
 * Props der Daumenleiste und ihrer Platzhalter am Live-Cockpit (Plan PR 3, Aufgabe 3.6).
 * Eigene Datei, weil `types.ts` an der Zeilengrenze steht; `LiveCockpitProps` erbt sie.
 */
import type { ReactNode } from 'react';

/** Getragene Farben der beiden Seiten eines Spiels (`wornColors`); `null` = keine Trikotfarbe festgelegt (@SL-161). */
export interface MatchSummaryFarben { home: string | null; away: string | null }

export type TiebreakWahl = 'overtime' | 'goldenGoal' | 'shootout';

export interface LiveCockpitLeisteProps {
  /**
   * Turnierleitung (`useCan('leadMatches')`, LT-5): nur sie bekommt „Korrigieren“ (@SL-159), der Helfer nach dem Abpfiff
   * den Hinweis „Korrektur über die Turnierleitung“ (@SL-045). Ohne Angabe gilt: kein Leitungsrecht.
   */
  istLeitung?: boolean;
  /**
   * „Korrigieren“ nach dem Ende (@SL-159, B-10a2): öffnet die Korrektur des Spiels mit Grund. Nur mit Handler und Leitungsrecht steht die
   * Taste da; der Helfer bekommt stattdessen den Hinweis (@HE-043).
   */
  onKorrigieren?(matchId: string): void;
  /** B-12 (@SL-174): „Nicht angetreten“ unter „Mehr“ (nur Turnierleitung, vor dem Anpfiff); öffnet den Dialog der Verwaltung */
  onNichtAngetreten?(matchId: string): void;
  /** Wer das Feld leitet, wenn dieses Gerät nur liest (@SL-046, @SL-015; Quelle B-49). Mit `onUebernehmen` steht „Spielleitung übernehmen“ da. */
  steuerung?: { leitetName: string | null; onUebernehmen?: () => void } | null;
  /** Das Recht wurde entzogen (@HE-056, A-18): ersetzt die ganze Hülle durch den Hinweis mit der Zahl übergebener Einträge. */
  zugriffEntzogen?: { uebergebeneEintraege: number } | null;
  /** Entscheidung nach Gleichstand wählen (@SL-053, B-09a); ohne Handler bleibt die Hauptaktion gesperrt. */
  onChooseTiebreak?(matchId: string, wahl: TiebreakWahl): void;
  /** Platz der Strafstoß-Form im Zustand `strafstoss` (@SL-103, @SL-135, B-09b); ohne sie zeigt die Fläche die Spalten. */
  strafstossForm?: ReactNode;
}
