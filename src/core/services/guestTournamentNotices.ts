/**
 * guestTournamentNotices.ts — C3b-2c (G7): Hinweis-Kanal für ausgeblendete Gast-Turniere.
 *
 * G7 (task-C3b-plan.md, Zeile G7): Wird ein Turnier mit Engine-Einträgen im
 * Gastkonto beim Anmelden NICHT hochgeladen (Migration, useInitialSync), gibt es
 * einmalig den Hinweis „nur im Gastmodus nutzbar – kann ins Konto übernommen
 * werden" (Übernahme = C3b-4).
 *
 * Gleiche Aufteilung wie `matchProtectionNotices.ts`: core/ emittiert ein
 * plattformfreies Event, ein dünner Hook (`useGuestTournamentNotices`,
 * `src/hooks/`) zeigt den übersetzten Toast. Dedup je Turnier-ID — der Hinweis
 * erscheint einmal und bleibt dann still, auch bei erneuten Sync-Läufen.
 */

export interface GuestTournamentNotice {
  /** Turnier, das im Konto ausgeblendet bleibt. */
  tournamentId: string;
  /** Titel für den Hinweis-Text. */
  title: string;
}

type Listener = (notice: GuestTournamentNotice) => void;

const listeners = new Set<Listener>();
const notified = new Set<string>();

/** Ruft die Skip-Stellen (Migration, useInitialSync) auf. Je Turnier-ID nur einmal. */
export function notifyGuestTournamentHidden(notice: GuestTournamentNotice): void {
  if (notified.has(notice.tournamentId)) {
    return;
  }
  notified.add(notice.tournamentId);
  listeners.forEach((listener) => listener(notice));
}

/** Abonniert Hinweise. Liefert eine Abbestell-Funktion (wie GenericMutationQueue.subscribe). */
export function subscribeToGuestTournamentNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}