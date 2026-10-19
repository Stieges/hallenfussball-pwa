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
