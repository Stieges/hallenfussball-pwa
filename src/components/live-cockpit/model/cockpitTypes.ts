/**
 * Gemeinsame Typen der Cockpit-Bereiche (reine Typen, kein React).
 */
export type Side = 'home' | 'away';
export type CardKind = 'YELLOW' | 'YELLOW_RED' | 'RED';
/** 'nummer' = Rückennummer ändern/nachtragen aus der Liste. Spielerwechsel gibt es nicht mehr (@SL-037, Aufgabe 3.3). */
export type EntryKind = 'tor' | 'karte' | 'zeitstrafe' | 'nummer';
export interface OffenerEintrag {
  art: EntryKind;
  seite: Side | null;
  kartenArt?: CardKind;
  eventId?: string;
  /** Spielzeit (ms) des ersten Tipps: der Eintrag trägt sie, auch wenn die Nummer erst später kommt (@SL-084). */
  ersterTippMs?: number;
  /** Tor-Ablauf: „Eigentor (Gegner)“ gewählt, die Nummer gehört dem Spieler des Gegners (@SL-022). */
  eigentor?: boolean;
  /** Per Taste geöffnet (Tastenkürzel, LT-7): dann Tastatur-Modus des Nummern-Bausteins, auch ohne feinen Zeiger (Auflage 8). */
  perTaste?: boolean;
}
export type Uebersetzer = (key: string, options?: Record<string, unknown>) => string;

/**
 * Interner Schlüssel der Eintragsart Zeitstrafe (kein Anzeigetext). Als Konstante, damit die
 * Glossar-Regel (`no-hardcoded-sport-terms-preferred`) nur an dieser einen Stelle ausgenommen ist.
 */
// eslint-disable-next-line local-rules/no-hardcoded-sport-terms-preferred -- interner Typ-Schlüssel, nicht sichtbar
export const EINTRAG_ZEITSTRAFE: EntryKind = 'zeitstrafe';

/** Mindestpause unterschritten (@SL-051): Team, tatsächliche und geforderte Pause in Minuten. Sperrt nichts. */
export interface MindestpauseHinweis { teamName: string; minuten: number; mindestMinuten: number }

/**
 * Die Bedienung der Hülle für die Daumenleiste und das Blatt „Mehr“ (Aufgabe 3.6): Uhr, Rückgängig und die Blätter.
 * Gebaut in `useCockpitCommands`; Rückgängig steht nur mit Engine-Ziel oder Sperrgrund da (A-08c, @FU-071).
 */
export interface CockpitControls {
  onUndo?: () => void;
  canUndo: boolean;
  /** Beschriftung mit Ziel („Tor Nr. 7 zurücknehmen“, @SL-038). */
  undoLabel?: string;
  /** Grund, warum Rückgängig gerade nicht geht (G3). */
  undoHint?: string;
  onStart: () => void;
  /** Pause, Weiter, Wiederanpfiff und Anpfiff der Verlängerung: die Uhr entscheidet nach dem Zustand. */
  onPauseResume: () => void;
  /** Abpfiff von Hand (öffnet ab LT-1 die Rückfrage). */
  onFinish: () => void;
  /** „Spiel fortsetzen“ (LT-6): öffnet das Blatt mit der Restzeit; ohne Handler keine Taste (@SL-075). */
  onFortsetzen?: () => void;
  onEventLog: () => void;
  onMore: () => void;
  /** A-08c: ohne Handler kein Punkt „Uhr korrigieren“ (@FU-071). */
  onEditTime?: () => void;
  onSwitchSides: () => void;
  onSettings: () => void;
}
