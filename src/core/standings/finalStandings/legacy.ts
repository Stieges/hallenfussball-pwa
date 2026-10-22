/**
 * Endstand für Turniere mit Finalrunde oder mehreren Gruppen – in Schnitt N nur vorläufig über den heutigen Weg
 * (`getMergedFinalRanking`, Paket TB/A-36b); die Regeln des Records für diese Turniere baut Schnitt F (A-19b, A-19a-Rest,
 * Daniel F12). Entfernte Teams bekommen keinen Platz (@ET-058, F5). Rein, ohne React.
 */
import type { Team } from '../../../types/tournament';
import type { TeamId } from '../../models/schemas/MatchSlotSchema';
import { groupKeyOf } from '../../models/standingsGroups';
import { getMergedFinalRanking, type FinalPlacement } from '../../../utils/calculations';
import { rankGroup } from '../groupTable';
import { tableInput } from '../tournamentTable';
import { FINAL_TYPE_RANKS } from '../../../utils/openPlacements';
import { groupPlaceInfo, type GroupPlaceInfo } from '../groupPlaces';
import type { ComputedFinalStandings, PlaceOrigin } from './types';
import type { FinalStandingsTournament } from './index';

function originOf(placement: FinalPlacement, groupPlaces: ReadonlyMap<string, GroupPlaceInfo>): PlaceOrigin {
  const { finalType, team } = placement;
  if (placement.decidedBy === 'playoff' && finalType !== undefined) {
    return { kind: 'placementGame', finalType, role: FINAL_TYPE_RANKS[finalType]?.[0] === placement.rank ? 'winner' : 'loser' };
  }
  if (placement.decidedBy === 'open') {
    return finalType === undefined ? { kind: 'open' } : { kind: 'open', finalType };
  }
  const groupPlace = groupPlaces.get(team.id)?.place ?? 0; // 0 = ohne Gruppe (Jeder gegen jeden)
  return { kind: 'groupPlace', group: groupKeyOf(team.group), place: groupPlace > 0 ? groupPlace : placement.rank };
}

/** Vorläufiger Endstand nach dem heutigen Weg (Teil F ersetzt ihn). */
export function legacyStandings(tournament: FinalStandingsTournament): ComputedFinalStandings {
  const teams: Team[] = tournament.teams;
  const overall = rankGroup(tableInput(teams, tournament.matches, tournament)).rows; // Gesamtwertung wie `calculateStandings`
  const { ranking } = getMergedFinalRanking(teams, tournament.matches, overall, tournament);
  const groupPlaces = groupPlaceInfo(teams, tournament.matches, tournament);
  return {
    state: 'provisional',
    ranking: ranking.filter((placement) => placement.team.isRemoved !== true).map((placement) => ({
      place: placement.rank,
      teamId: placement.team.id as TeamId,
      teamName: placement.team.name,
      origin: originOf(placement, groupPlaces),
    })),
  };
}
