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
/**
 * M11 (task-C3b2-review.md): ein Hinweis, der VOR dem ersten Abo kommt (z. B.
 * `useInitialSync` meldet frueher als `useGuestTournamentNotices` mountet), wurde
 * bisher trotzdem als „gemeldet" gemerkt und ging fuer die Sitzung verloren — ohne
 * jeden Zuhoerer war `listeners.forEach` ein no-op, aber `notified.add` lief schon.
 * Jetzt: ohne Zuhoerer wird NICHT als gemeldet gemerkt, sondern gepuffert; der
 * naechste Abonnent bekommt den Puffer sofort zugestellt (keine Speicherung ueber
 * die Sitzung hinaus — nur dieses Modul-Array, das bei App-Start/Reload leer ist).
 */
const pending: GuestTournamentNotice[] = [];

/** Ruft die Skip-Stellen (Migration, useInitialSync) auf. Je Turnier-ID nur einmal. */
export function notifyGuestTournamentHidden(notice: GuestTournamentNotice): void {
  if (notified.has(notice.tournamentId)) {
    return;
  }
  if (listeners.size === 0) {
    if (!pending.some((p) => p.tournamentId === notice.tournamentId)) {
      pending.push(notice);
    }
    return;
  }
  notified.add(notice.tournamentId);
  listeners.forEach((listener) => listener(notice));
}

/** Abonniert Hinweise. Liefert eine Abbestell-Funktion (wie GenericMutationQueue.subscribe). */
export function subscribeToGuestTournamentNotices(listener: Listener): () => void {
  listeners.add(listener);
  if (pending.length > 0) {
    const toDeliver = pending.splice(0, pending.length);
    for (const notice of toDeliver) {
      if (notified.has(notice.tournamentId)) {
        continue;
      }
      notified.add(notice.tournamentId);
      listener(notice);
    }
  }
  return () => {
    listeners.delete(listener);
  };
}