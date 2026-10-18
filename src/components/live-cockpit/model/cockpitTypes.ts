/**
 * Gemeinsame Typen der Cockpit-Bereiche (reine Typen, kein React).
 */
export type Side = 'home' | 'away';
export type CardKind = 'YELLOW' | 'YELLOW_RED' | 'RED';
/** 'wechsel' entfällt in Aufgabe 3.3, 'nummer' = Rückennummer ändern/nachtragen aus der Liste. */
export type EntryKind = 'tor' | 'karte' | 'zeitstrafe' | 'wechsel' | 'nummer';
export interface OffenerEintrag {
  art: EntryKind;
  seite: Side | null;
  kartenArt?: CardKind;
  eventId?: string;
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
