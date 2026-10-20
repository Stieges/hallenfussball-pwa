/**
 * Reihenfolge bei Punktgleichheit – Voreinstellung für private Hallenturniere nach BFV Teil 3 § 20 (13)
 * (Record `2026-09-27_wizard-regelinhalte`, @W2A-046): Punkte, direkter Vergleich, Tordifferenz, erzielte Tore.
 * Ohne `label`: die Anzeige löst über `id` gegen i18n auf (core ohne React).
 */
import type { PlacementCriterion } from '../../types/tournament';

export const DEFAULT_PLACEMENT_LOGIC: readonly Readonly<PlacementCriterion>[] = Object.freeze([
  Object.freeze({ id: 'points', enabled: true }),
  Object.freeze({ id: 'directComparison', enabled: true }),
  Object.freeze({ id: 'goalDifference', enabled: true }),
  Object.freeze({ id: 'goalsFor', enabled: true }),
]);

/** Frische, veränderbare Kopie der Voreinstellung (für neue Turniere, Import, Vorlagen). */
export const defaultPlacementLogic = (): PlacementCriterion[] => DEFAULT_PLACEMENT_LOGIC.map((c) => ({ ...c }));

/** Leere oder fehlende Liste ⇒ Voreinstellung (Befund C-WERTUNG-LEER); sonst die gespeicherte Liste. */
export const effectivePlacementLogic = (list: readonly PlacementCriterion[] | null | undefined): PlacementCriterion[] =>
  list === null || list === undefined || list.length === 0 ? defaultPlacementLogic() : [...list];
