/**
 * Was der PDF-Dialog anbietet und was vorgewählt ist (B-28 C8; @DR-011, @DR-009, @DR-048 Z. 2 und 3, @DR-049, @ZM-019, @BM-041).
 * Rein, ohne React.
 * - Endstand: nur für Turnierleitung und Co-Admin (`canFinal`, Recht aus rolePermissions.json über useCan), Helfer sehen die Karte nicht.
 *   Ausgegraut vor dem Abschluss und nach einem Abbruch („Erst nach Abschluss des Turniers“), solange der gespeicherte Endstand lädt
 *   oder nicht lesbar ist, und wenn Ergebnisse oder Tabellen für Zuschauer ausgeblendet sind: ein PDF für alle zeigt dann keine Plätze
 *   (Record Drucken A5.3, Kindermodus-Lecks im Record Endstand).
 * - Spielplan: nach dem Abschluss nennt er den ganzen Endstand (@DR-009); solange der gespeicherte Endstand fehlt, entsteht er nicht
 *   (sonst stünde „Die Platzierung steht nach dem Finale fest“ in einem abgeschlossenen Turnier).
 * - Zuschauer: nur „Spielplan“ (@BM-057), nach dem Abschluss dazu der Endstand, wenn die Zuschauer-Seite ihn zeigen darf (@BM-041).
 */
import type { PdfChoice } from './buildChoice';
import type { FinalPdfSource } from './finalPdfSource';

export type OfferReason = 'notFinished' | 'loading' | 'unavailable' | 'hidden' | 'notShared';

/** Eine Karte: wählbar oder ausgegraut mit Grund. */
export interface Offer { available: boolean; reason?: OfferReason }

/** `null` = die Karte steht nicht im Dialog. */
export type PdfOffers = Record<PdfChoice, Offer | null>;

export interface OfferInput {
  viewer: boolean;
  finished: boolean;
  final: FinalPdfSource;
  canFinal: boolean;
  canNotice: boolean;
  shared: boolean;
  hideScores: boolean;
  hideTables: boolean;
}

const yes: Offer = { available: true };
const no = (reason: OfferReason): Offer => ({ available: false, reason });

/** Grund, warum der gespeicherte Endstand (noch) nicht da ist. */
function waiting(final: FinalPdfSource): Offer {
  return final.kind === 'ready' ? yes : no(final.kind === 'loading' ? 'loading' : 'unavailable');
}

export function pdfOffers(input: OfferInput): PdfOffers {
  const { viewer, finished, final } = input;
  if (viewer) {
    return { schedule: yes, blank: null, final: final.kind === 'ready' ? yes : null, notice: null };
  }
  // Ohne Tabellen druckt das PDF keine Platzierung (visibility.ts): dann braucht der Spielplan den Endstand nicht
  const schedule = finished && !input.hideTables ? waiting(final) : yes;
  let finalOffer: Offer | null = null;
  if (input.canFinal) {
    finalOffer = !finished ? no('notFinished') : input.hideScores || input.hideTables ? no('hidden') : waiting(final);
  }
  return {
    schedule,
    blank: yes,
    final: finalOffer,
    notice: input.canNotice ? (input.shared ? yes : no('notShared')) : null,
  };
}

/**
 * Vorwahl: nach dem Abschluss der Endstand (@DR-048 Z. 2), sonst der Spielplan, sonst die erste wählbare Karte. Solange der
 * gespeicherte Endstand lädt, bleibt die Vorwahl beim Endstand (ohne Endstand-Karte beim Spielplan): die Karte ist dann gesperrt
 * und „Als PDF speichern“ auch – ein schneller Tipp erzeugt nie die Fassung ohne Ergebnisse (Review #460).
 */
export function preferredChoice(offers: PdfOffers): PdfChoice {
  if (offers.final?.reason === 'loading') {
    return 'final';
  }
  if (offers.schedule?.reason === 'loading') {
    return 'schedule';
  }
  const order: PdfChoice[] = ['final', 'schedule', 'blank', 'notice'];
  return order.find((choice) => offers[choice]?.available === true) ?? 'schedule';
}

/** Ist die gewählte Karte wählbar? Sonst gibt es kein „Als PDF speichern“. */
export const choiceAvailable = (offers: PdfOffers, choice: PdfChoice): boolean => offers[choice]?.available === true;
