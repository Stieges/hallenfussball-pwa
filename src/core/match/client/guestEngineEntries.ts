/**
 * guestEngineEntries.ts — C3b-2c (G7): Prädikat „Turnier hat Engine-Einträge im Gastkonto".
 *
 * G7 (task-C3b-plan.md, Zeile G7): Ein Turnier, für das die lokale Engine-Kopie des
 * Gastkontos ('guest') bestätigte Einträge hat, darf auf KEINEM Upload-Weg in das
 * Konto geladen werden (Migration, syncUp, Queue-Flush, resolveConflict/syncTournament,
 * useInitialSync) — sonst gingen die Einträge verloren. Zuordnung: matchId ∈
 * tournament.matches, „Einträge" = confirmed.length > 0.
 *
 * Framework-frei (core/match/client, kein React).
 */
import { LocalMatchStore } from './LocalMatchStore';
import type { MatchCopy } from './matchCopy';

export const GUEST_ACCOUNT_ID = 'guest';

/** Minimale Turnier-Sicht des Prädikats (strukturelle Typung, kein Models-Import noetig). */
export interface GuestEntryCheckTournament {
  matches?: { id: string }[];
}

/** Quelle der lokalen Kopien — `LocalMatchStore.forAccount` reicht; Injektion fuer Tests. */
export interface GuestEntrySource {
  forAccount(accountId: string): Promise<MatchCopy[]>;
}

let defaultSource: GuestEntrySource | null = null;

function resolveSource(source?: GuestEntrySource): GuestEntrySource {
  if (source) {
    return source;
  }
  defaultSource ??= new LocalMatchStore();
  return defaultSource;
}

/**
 * True, wenn mindestens eine Gast-Kopie zu einem Match des Turniers bestaetigte
 * Engine-Eintraege traegt. Liest nur den Store — keine Mutation.
 *
 * Fail-closed: Laesst sich der Store nicht lesen, gilt das Turnier als „mit Eintraegen"
 * (kein Upload). G7 verlangt, dass solche Turniere auf KEINEM Weg ins Konto geladen
 * werden — ein unsicherer Lesefehler darf die Wache nicht oeffnen.
 */
export async function hasGuestEngineEntries(
  tournament: GuestEntryCheckTournament,
  source?: GuestEntrySource,
): Promise<boolean> {
  const matchIds = new Set((tournament.matches ?? []).map((match) => match.id));
  if (matchIds.size === 0) {
    // Ohne Matches gibt es keine matchId-Zuordnung — also keine Einträge,
    // die verloren gehen koennten. Der Store muss dann nicht gelesen werden.
    return false;
  }
  let copies: MatchCopy[];
  try {
    copies = await resolveSource(source).forAccount(GUEST_ACCOUNT_ID);
  } catch {
    return true;
  }
  return copies.some((copy) => matchIds.has(copy.matchId) && copy.confirmed.length > 0);
}

/**
 * G7: Entfernt Turniere mit Gast-Einträgen aus einer Anzeige-Liste.
 * Wird nur in den Anzeige-Hooks verwendet — `listForCurrentUser` bleibt unverändert,
 * damit das Turnier-Limit weiter zaehlt und der Gastmodus alles sieht.
 */
export async function filterWithoutGuestEngineEntries<T extends GuestEntryCheckTournament>(
  tournaments: T[],
  source?: GuestEntrySource,
): Promise<T[]> {
  const visible: T[] = [];
  for (const tournament of tournaments) {
    if (!(await hasGuestEngineEntries(tournament, source))) {
      visible.push(tournament);
    }
  }
  return visible;
}