/**
 * engineCommandWiringHelpers (C3a-2a Fixrunde 3, P8/E2/W11; A-08d2b): reine Hilfsfunktionen der
 * Engine-Verdrahtung. Die frueheren "guarded delegates" (Altweg-Wache) sind entfernt.
 */
import { LocalStoreFullError, MatchCommandRejectedError } from '../core/match/client';
import { ERROR_CODES } from '../core/match/types';

/**
 * A-08b (@FU-069): Grund einer Ablehnung -> i18n-Schluessel der Anzeige. Ein Tor nach Spielende
 * zeigt den Hinweis „Korrektur über die Turnierleitung“; Speicher voll: eigener Text; alles andere
 * (inkl. Nicht-Engine-Spiel) ist „gerade nicht möglich“ – kein Verweis auf eine spätere Umsetzung.
 */
export type RejectionMessageKey = 'engine.storeFull' | 'engine.retract.hint.goalFinished' | 'engine.invalidKit' | 'engine.invalid';

export function rejectionMessageKey(error: unknown): RejectionMessageKey {
  if (error instanceof LocalStoreFullError) { return 'engine.storeFull'; }
  if (error instanceof MatchCommandRejectedError && error.code === ERROR_CODES.MATCH_FINISHED) {
    return 'engine.retract.hint.goalFinished';
  }
  // A-30a (@SL-137): ungültige Trikot-/Leibchenfarbe beim Anpfiff – eigener, verständlicher Text.
  if (error instanceof MatchCommandRejectedError && (error.detail as { reason?: unknown } | undefined)?.reason === 'INVALID_KIT') {
    return 'engine.invalidKit';
  }
  return 'engine.invalid';
}
