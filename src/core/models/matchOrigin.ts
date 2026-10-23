/**
 * Herkunft des PLATZES am Spiel (A-36a, MVP-Bauplan § 23). Framework-frei.
 *
 * `originA/originB` wird beim Anlegen aus der Definition gesetzt (playoffScheduler) und danach nie geändert –
 * anders als `slotA.source`/`resolvedFrom`, die nach „Neu besetzen“ wegfallen. Alle Stellen, die ein Spiel
 * Feld für Feld neu bauen, reichen die Herkunft über `matchOrigins` durch.
 *
 * Anforderungen: @DR-005, @BM-014, @SA-011 (Datenteil).
 */
import type { SlotSource } from './schemas/MatchSlotSchema';

export interface MatchOrigins {
  originA?: SlotSource;
  originB?: SlotSource;
}

/** Nur die gesetzte Herkunft (Gruppenspiel → `{}`), damit kein Schlüssel mit `undefined` entsteht. */
export function matchOrigins(match: MatchOrigins): MatchOrigins {
  return {
    ...(match.originA !== undefined && { originA: match.originA }),
    ...(match.originB !== undefined && { originB: match.originB }),
  };
}
