/**
 * Wohin führt die Adresse der App auf einem Helfer-Gerät? (A-17c; @HE-096, @HE-098, @HE-099, @HE-028)
 * Reine Entscheidung ohne React und ohne Netz – die Einträge kommen aus dem Zugangs-Index (nach dem Frischabgleich).
 *
 * Regeln:
 * - Konto angemeldet → bleiben (Rechte aus Konto und Helfer-Zugang bleiben getrennt).
 * - Genau ein laufender Zugang → direkt ans Feld (@HE-096); der Abschluss eines anderen zählt nicht mit (@HE-099 „Aber …“).
 * - Zwei oder mehr laufende Zugänge → Auswahl (@HE-099).
 * - Lokale Turniere außerhalb des Index (Gast-Turniere) bleiben sichtbar (Pflichtzeile GA5 v2.1, Review #331): dann immer
 *   die Auswahl statt des direkten Wegs, und ohne laufenden Zugang bleibt die Startseite.
 * - Kein laufender Zugang, aber ein junger Endzustand (entzogen, nur zusehen, abgeschlossen, Anfrage offen) → die Endkarte
 *   der Helfer-Seite über `/join/:code` (@HE-098 Zeilen 1 und 2). „Jung“: höchstens `END_REDIRECT_MAX_AGE_DAYS` Tage
 *   (Vorschlag, offene Frage an Daniel), sonst fände Tom die Startseite nie wieder.
 * - Nie allein wegen `is_anonymous`: ohne Eintrag im Index passiert nichts.
 */
import type { HelperAccessEntry } from '../../core/repositories/helperAccessRpc';
import type { SessionKind } from '../../core/auth/deviceSession';

export const END_REDIRECT_MAX_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HelperStartTarget =
  | { kind: 'stay' }
  | { kind: 'field'; tournamentId: string; field: number }
  | { kind: 'chooser' }
  | { kind: 'join'; code: string };

export interface HelperStartInput {
  sessionKind: SessionKind;
  entries: readonly HelperAccessEntry[];
  /** Gibt es lokale Turniere, die nicht zu einem Helfer-Zugang gehören? */
  hasOtherTournaments: boolean;
  now?: Date;
}

/** Laufender Zugang: zugelassen und das Turnier ist nicht abgeschlossen. */
export function isRunningAccess(entry: HelperAccessEntry): boolean {
  return entry.relation === 'accepted' && !entry.closed;
}

function isRecentEndState(entry: HelperAccessEntry, now: Date): boolean {
  const endState = entry.relation === 'revoked' || entry.relation === 'viewer' || entry.relation === 'pending' || (entry.relation === 'accepted' && entry.closed);
  const updated = Date.parse(entry.updatedAt);
  return endState && !Number.isNaN(updated) && now.getTime() - updated <= END_REDIRECT_MAX_AGE_DAYS * DAY_MS;
}

export function decideHelperStart({ sessionKind, entries, hasOtherTournaments, now = new Date() }: HelperStartInput): HelperStartTarget {
  if (sessionKind === 'account') {
    return { kind: 'stay' };
  }
  const running = entries.filter(isRunningAccess);
  if (running.length >= 2 || (running.length === 1 && hasOtherTournaments)) {
    return { kind: 'chooser' };
  }
  if (running.length === 1) {
    return { kind: 'field', tournamentId: running[0].tournamentId, field: running[0].field ?? 1 };
  }
  if (hasOtherTournaments) {
    return { kind: 'stay' };
  }
  const newest = entries
    .filter((entry) => isRecentEndState(entry, now))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return newest ? { kind: 'join', code: newest.code } : { kind: 'stay' };
}
