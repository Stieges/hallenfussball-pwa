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
 * Wirft bei einem Lesefehler des Stores (PC29): Ein Lesefehler ist KEIN „true" — der
 * Aufrufer entscheidet je Weg (Upload-Wege: nicht hochladen/nicht loeschen, Queue:
 * Versuch fehlschlagen lassen, Anzeige: Turnier sichtbar lassen).
 */
export async function hasGuestEngineEntries(
  tournament: GuestEntryCheckTournament,
  source?: GuestEntrySource,
): Promise<boolean> {
  // M3 (task-C3b2-review.md): die Engine legt Kopien unter `match.id.toLowerCase()` ab
  // (`engineMatchModel.ts:71`) — bei einer Match-ID mit Grossbuchstaben (Import/
  // Altbestand) verglich diese Menge bisher die ROHE `match.id` und verfehlte den
  // Treffer. Beide Seiten `toLowerCase()`, damit der Vergleich unabhaengig von der
  // Schreibweise der Turnier-Match-ID greift.
  const matchIds = new Set((tournament.matches ?? []).map((match) => match.id.toLowerCase()));
  if (matchIds.size === 0) {
    // Ohne Matches gibt es keine matchId-Zuordnung — also keine Einträge,
    // die verloren gehen koennten. Der Store muss dann nicht gelesen werden.
    return false;
  }
  const copies = await resolveSource(source).forAccount(GUEST_ACCOUNT_ID);
  return copies.some((copy) => matchIds.has(copy.matchId.toLowerCase()) && copy.confirmed.length > 0);
}

/**
 * G7: Entfernt Turniere mit Gast-Einträgen aus einer Anzeige-Liste.
 * Wird nur in den Anzeige-Hooks verwendet — `listForCurrentUser` bleibt unverändert,
 * damit das Turnier-Limit weiter zaehlt und der Gastmodus alles sieht.
 * Lesefehler des Stores: Turnier bleibt sichtbar (fail-open, PC29) — Ausblenden ist nur
 * Anzeige, das Verhindern des Uploads sichern die Upload-Wege selbst.
 */
export async function filterWithoutGuestEngineEntries<T extends GuestEntryCheckTournament>(
  tournaments: T[],
  source?: GuestEntrySource,
): Promise<T[]> {
  const visible: T[] = [];
  for (const tournament of tournaments) {
    let hidden: boolean;
    try {
      hidden = await hasGuestEngineEntries(tournament, source);
    } catch {
      hidden = false;
    }
    if (!hidden) {
      visible.push(tournament);
    }
  }
  return visible;
}