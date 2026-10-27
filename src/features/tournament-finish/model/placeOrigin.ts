/**
 * Herkunft eines Platzes im Endstand als Text (R3-5, @ET-041; Record Endstand „Wie ein Platz entsteht“): „Sieger Finale“,
 * „Verlierer Halbfinale“, „Dritter Gruppe A“, „Platz 4 der Tabelle“ (Jeder gegen jeden), „noch offen“ (nur vorläufig).
 * Die Texte stehen in `tournament.finalStandings.origin.*` (DE/EN). Rein, ohne React.
 */
import type { TFunction } from 'i18next';
import type { Tournament } from '../../../types/tournament';
import type { PlaceOrigin } from '../../../core/standings/finalStandings';
import { getGroupDisplayName } from '../../../utils/displayNames';

const GROUP_PLACE_KEYS = [
  'finalStandings.origin.groupPlace.1', 'finalStandings.origin.groupPlace.2', 'finalStandings.origin.groupPlace.3', 'finalStandings.origin.groupPlace.4',
  'finalStandings.origin.groupPlace.5', 'finalStandings.origin.groupPlace.6', 'finalStandings.origin.groupPlace.7', 'finalStandings.origin.groupPlace.8',
] as const;

export function placeOriginLabel(origin: PlaceOrigin, t: TFunction<'tournament'>, tournament: Pick<Tournament, 'groups'>): string {
  switch (origin.kind) {
    case 'placementGame':
      return t(`finalStandings.origin.${origin.finalType}.${origin.role}`);
    case 'koRound':
      return t(`finalStandings.origin.koRound.${origin.round}`);
    case 'open':
      return t('finalStandings.origin.open');
    case 'groupPlace': {
      if (origin.group === '') {
        return t('finalStandings.origin.table', { place: origin.place });
      }
      const group = getGroupDisplayName(origin.group, tournament);
      const ordinalKey = GROUP_PLACE_KEYS[origin.place - 1];
      return ordinalKey !== undefined
        ? t(ordinalKey, { group })
        : t('finalStandings.origin.groupPlaceOther', { place: origin.place, group });
    }
  }
}
