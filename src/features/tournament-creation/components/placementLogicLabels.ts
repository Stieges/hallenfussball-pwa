import { TFunction } from 'i18next';
import { PlacementCriterion } from '../../../types/tournament';

/**
 * Löst die Anzeige-Beschriftung eines Platzierungskriteriums auf.
 *
 * Neue Kriterien tragen nur eine `id` (siehe TournamentCreationService) —
 * die Beschriftung kommt aus `wizard.json` (`placementLogic.criteria.<id>`).
 * Bereits gespeicherte Turniere aus der Zeit vor der Terminologie-Zentralisierung
 * (oder importierte Daten mit einer `id` ohne passenden Schlüssel) tragen noch
 * ein `label` — das bleibt der Rückfall, damit diese Turniere lesbar bleiben.
 */
export function resolvePlacementCriterionLabel(
  t: TFunction<'wizard'>,
  criterion: PlacementCriterion
): string {
  return t(`placementLogic.criteria.${criterion.id}`, {
    defaultValue: criterion.label ?? criterion.id,
  });
}
