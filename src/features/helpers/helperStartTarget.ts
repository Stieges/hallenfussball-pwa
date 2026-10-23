/**
 * Wohin führt die Adresse der App auf einem Helfer-Gerät? (A-17c; @HE-096, @HE-098, @HE-099, @HE-109, @HE-028)
 * Reine Entscheidung ohne React und ohne Netz – die Einträge kommen aus dem Zugangs-Index (nach dem Frischabgleich).
 *
 * Regel (Daniel, 23.10.): „Die App öffnet direkt, was gerade läuft; laufen mehrere, fragt sie.“ Laufen = Turniertag heute oder
 * angepfiffen und nicht abgeschlossen (`runningState.ts`), für Helfer-Zugänge UND eigene Turniere auf dem Gerät.
 * - Konto angemeldet → bleiben (Rechte aus Konto und Helfer-Zugang bleiben getrennt).
 * - Genau eines läuft → direkt öffnen (Helfer: sein Feld), ohne Zwischenfrage – ein eigenes Turnier, das nicht läuft, hält den
 *   Weg ans Feld nicht auf (@HE-096).
 * - Zwei oder mehr laufen → Auswahl, eigene laufende Turniere stehen mit drin (@HE-099).
 * - Keines läuft → Startseite; ein zugelassener, nicht abgeschlossener Einsatz steht dort als Karte (@HE-109). Gibt es
 *   weder Einsatz noch eigene Turniere, aber einen jungen Endzustand (entzogen, nur zusehen, abgeschlossen, Anfrage offen),
 *   führt die Adresse zur Endkarte der Helfer-Seite über `/join/:code` (@HE-098 Zeilen 1 und 2). „Jung“: höchstens
 *   `END_REDIRECT_MAX_AGE_DAYS` Tage (Vorschlag), sonst fände Tom die Startseite nie wieder.
 * - Nie allein wegen `is_anonymous`: ohne Eintrag im Index passiert nichts.
 */
import type { HelperAccessEntry } from '../../core/repositories/helperAccessRpc';
import type { SessionKind } from '../../core/auth/deviceSession';
import { isOpenAssignment, isRunningHelperEntry } from './runningState';

export const END_REDIRECT_MAX_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HelperStartTarget =
  | { kind: 'stay' }
  | { kind: 'field'; tournamentId: string; field: number }
  | { kind: 'own'; tournamentId: string }
  | { kind: 'chooser' }
  | { kind: 'join'; code: string };

export interface HelperStartInput {
  sessionKind: SessionKind;
  entries: readonly HelperAccessEntry[];
  /** Eigene Turniere auf dem Gerät (ohne die Helfer-Turniere des Index), die gerade laufen. */
  ownRunningIds?: readonly string[];
  /** Gibt es überhaupt eigene Turniere auf dem Gerät (laufend oder nicht)? */
  hasOwnTournaments?: boolean;
  now?: Date;
}

function isRecentEndState(entry: HelperAccessEntry, now: Date): boolean {
  const endState = entry.relation === 'revoked' || entry.relation === 'viewer' || entry.relation === 'pending' || (entry.relation === 'accepted' && entry.closed);
  const updated = Date.parse(entry.updatedAt);
  return endState && !Number.isNaN(updated) && now.getTime() - updated <= END_REDIRECT_MAX_AGE_DAYS * DAY_MS;
}

export function decideHelperStart({ sessionKind, entries, ownRunningIds = [], hasOwnTournaments = false, now = new Date() }: HelperStartInput): HelperStartTarget {
  if (sessionKind === 'account') {
    return { kind: 'stay' };
  }
  const running = entries.filter((entry) => isRunningHelperEntry(entry, now));
  if (running.length + ownRunningIds.length >= 2) {
    return { kind: 'chooser' };
  }
  if (running.length === 1) {
    return { kind: 'field', tournamentId: running[0].tournamentId, field: running[0].field ?? 1 };
  }
  if (ownRunningIds.length === 1) {
    return { kind: 'own', tournamentId: ownRunningIds[0] };
  }
  if (hasOwnTournaments || entries.some(isOpenAssignment)) {
    return { kind: 'stay' };
  }
  const newest = entries
    .filter((entry) => isRecentEndState(entry, now))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return newest ? { kind: 'join', code: newest.code } : { kind: 'stay' };
}
