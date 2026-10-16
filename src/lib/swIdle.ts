/**
 * Leerlauf-Pruefung vor dem automatischen Neuladen (C3b-2d, G8).
 *
 * Automatisch neu geladen wird NUR im Leerlauf. Leerlauf = BEIDES:
 * (a) kein Element `[role="dialog"][aria-modal="true"]` im DOM, und
 * (b) der Ausgang des aktuellen Kontos ist sicher leer
 *     (`countWaitingEntries(store, accountId) === 0`, pending + acked ueber alle Kopien).
 *
 * Fehlerverhalten (verbindlich, ohne Ausnahme):
 * - Zaehler wirft/lehnt ab -> gilt als NICHT Leerlauf, spaeter wird erneut geprueft
 *   (im Zweifel nie automatisch neu laden; der Knopf bleibt der sichere Weg).
 * - Kein Konto/kein Engine-Kontext -> nur Bedingung (a).
 * - `isIdle` wirft nie: auch unerwartete Fehler gelten als NICHT Leerlauf.
 *
 * Framework-frei (kein React), alle Eingaben injizierbar -- damit bleibt die Logik
 * ohne DOM- und ohne Engine-Anbindung testbar.
 */

/** Version-Check alle 30 Minuten (zusaetzlich zu visibilitychange/`online`). */
export const UPDATE_POLL_MS = 30 * 60 * 1000;

/** Erneute Leerlauf-Pruefung, solange kein Leerlauf herrscht: spaetestens alle 60 s. */
export const IDLE_RECHECK_MS = 60 * 1000;

/** Entprellung des Mutation-Observers: viele DOM-Aenderungen hintereinander = eine Pruefung. */
export const OBSERVER_DEBOUNCE_MS = 100;

/** Eingaben der Leerlauf-Pruefung -- injizierbar, damit die Logik ohne DOM/Store testbar bleibt. */
export interface IdleDeps {
  /** Bedingung (a): true, wenn ein modaler Dialog offen ist. */
  hasOpenModalDialog: () => boolean;
  /** Bedingung (b): Anzahl der wartenden Ausgangs-Eintraege des aktuellen Kontos. */
  countWaiting: () => Promise<number>;
  /** false, wenn kein Konto/kein Engine-Kontext verfuegbar ist (dann zaehlt nur (a)). */
  hasAccount: () => boolean;
}

/**
 * Bedingung (a): echter modaler Dialog = `role="dialog"` UND `aria-modal="true"`.
 * Ein `role="dialog"` OHNE `aria-modal` (z. B. Popover) blockiert bewusst nicht.
 */
export function hasOpenModalDialog(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * true = Leerlauf (automatisches Neuladen erlaubt), false = nicht/unklar (nicht neu laden).
 * Wirft nie; ein unerwarteter Fehler zaehlt als nicht Leerlauf (Grundsatz „Im Zweifel nie
 * automatisch neu laden").
 */
export async function isIdle(deps: IdleDeps): Promise<boolean> {
  try {
    if (deps.hasOpenModalDialog()) {
      return false;
    }
    if (!deps.hasAccount()) {
      return true;
    }
    return (await deps.countWaiting()) === 0;
  } catch {
    return false;
  }
}
