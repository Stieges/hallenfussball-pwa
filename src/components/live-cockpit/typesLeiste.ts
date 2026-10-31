/**
 * Props der Daumenleiste und ihrer Platzhalter am Live-Cockpit (Plan PR 3, Aufgabe 3.6).
 * Eigene Datei, weil `types.ts` an der Zeilengrenze steht; `LiveCockpitProps` erbt sie.
 */
import type { ReactNode } from 'react';
import type { LiveCockpitFarbenProps } from './typesFarben';

/** Getragene Farben der beiden Seiten eines Spiels (`wornColors`); `null` = keine Trikotfarbe festgelegt (@SL-161). */
export interface MatchSummaryFarben { home: string | null; away: string | null }

export type TiebreakWahl = 'overtime' | 'goldenGoal' | 'shootout';

export interface LiveCockpitLeisteProps extends LiveCockpitFarbenProps {
  /** Öffnet die Übersicht der Tastenkürzel (Taste `?`, @SL-153); die Übersicht gehört dem Rahmen, damit auch der Knopf im Kopf sie öffnet. */
  onTastenuebersicht?(): void;
  /**
   * Turnierleitung (`useCan('leadMatches')`, LT-5): nur sie bekommt „Korrigieren“ (@SL-159), der Helfer nach dem Abpfiff
   * den Hinweis „Korrektur über die Turnierleitung“ (@SL-045). Ohne Angabe gilt: kein Leitungsrecht.
   */
  istLeitung?: boolean;
  /** Turnier abgeschlossen (R3-3, @LZ-036): das Cockpit liest nur und sagt es -- für Leitung und Helfer, nie „Korrektur über die Turnierleitung“. */
  abgeschlossen?: boolean;
  /**
   * „Korrigieren“ nach dem Ende (@SL-159, B-10a2): öffnet die Korrektur des Spiels mit Grund. Nur mit Handler und Leitungsrecht steht die
   * Taste da; der Helfer bekommt stattdessen den Hinweis (@HE-043).
   */
  onKorrigieren?(matchId: string): void;
  /**
   * Der Endstand dieses Spiels steht noch als Quittung (`useEndstandHalten`, @SL-152): nur dann „Spiel fortsetzen“ (LT-6). Nach „Weiter“
   * ist das Spiel quittiert (`false`, @SL-075 Z. 1, @SL-162). Ohne Angabe wird nie angeboten (im Zweifel zu, Review #422 🟢 b).
   */
  endstandSteht?: boolean;
  /** B-12 (@SL-174): „Nicht angetreten“ unter „Mehr“ (nur Turnierleitung, vor dem Anpfiff); öffnet den Dialog der Verwaltung */
  onNichtAngetreten?(matchId: string): void;
  /**
   * Ein anderes Gerät steuert das Feld, dieses liest nur (@FU-026, @SL-046; Quelle B-49 `useCockpitFieldControl`): Zeile „Feld 2 wird
   * von Tom gesteuert“ (ohne Namen „… von einem anderen Gerät …“), nach dem Verlust der Steuer „Die Spielleitung hat jetzt Olli“
   * (`verloren`, @FU-027). Mit `onUebernehmen` steht „Spielleitung übernehmen“ da (nur die Turnierleitung).
   */
  steuerung?: { leitetName: string | null; verloren?: boolean; onUebernehmen?: () => void } | null;
  /** Das Recht wurde entzogen (@HE-056, A-18): ersetzt die ganze Hülle durch den Hinweis mit der Zahl übergebener Einträge. */
  zugriffEntzogen?: { uebergebeneEintraege: number } | null;
  /** Entscheidung nach Gleichstand wählen (@SL-053, B-09a); ohne Handler bleibt die Hauptaktion gesperrt. */
  onChooseTiebreak?(matchId: string, wahl: TiebreakWahl): void;
  /** Platz der Strafstoß-Form im Zustand `strafstoss` (@SL-103, @SL-135, B-09b); ohne sie zeigt die Fläche die Spalten. */
  strafstossForm?: ReactNode;
}
