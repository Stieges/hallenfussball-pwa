/**
 * Prüfung eines Gleichstands-Eintrags gegen das Turnier, ohne zu schreiben (Paket TB, Plan v2 § 3.2): dieselben
 * Prüfungen in der Tabelle (`StandingDecisionService.decide`) und beim Abschluss ohne Netz (GA4 A-13b/A-15c, @TM-146).
 * Reihenfolge: zuerst der Eintrag selbst (Sieger, Reihenfolge, Grund), dann der Stand der Tabelle (schon entschieden,
 * Block geändert, „Ergebnis so akzeptieren“ erlaubt). Die Gruppenkennung kommt aus der gerechneten Tabelle (`groupId` im
 * Ergebnis): bei genau einer Buchstabengruppe wird ein Eintrag mit leerer Kennung auf sie bezogen (Review TB-A Auflage 1).
 * Rein, ohne React.
 */
import type { Tournament } from '../../types/tournament';
import { checkDraftFields, sameTeamSet, sharedPlaceAllowed, type DecisionDraft, type DecisionErrorCode } from './decisions';
import { rankGroup } from './groupTable';
import { tableInput } from './tournamentTable';

export type DraftCheck =
  | { ok: true; groupId: string; block: { place: number; size: number } }
  | { ok: false; code: DecisionErrorCode };

type CheckedTournament = Pick<Tournament, 'teams' | 'matches' | 'pointSystem' | 'placementLogic' | 'standingDecisions' | 'placementsToPlayOut' | 'forfeitScore'>;

export function validateDraft(draft: DecisionDraft, tournament: CheckedTournament): DraftCheck {
  const fieldError = checkDraftFields(draft);
  if (fieldError !== null) {
    return { ok: false, code: fieldError };
  }
  const input = tableInput(tournament.teams, tournament.matches, tournament, draft.groupId);
  const groupId = input.groupId;
  const table = rankGroup(input);
  // „Von wem“ steht nicht im öffentlich lesbaren config (@W2A-072); es kommt mit dem Verlaufsprotokoll (GA4 A-13b).
  if (table.rows.some((r) => r.decision !== undefined && sameTeamSet(r.decision.teamIds, draft.teamIds))) {
    return { ok: false, code: 'ALREADY_DECIDED' };
  }
  const blockRows = table.rows.filter((r) => draft.teamIds.includes(r.team.id));
  const open = table.openTies.some((block) => sameTeamSet(block, draft.teamIds));
  if (!open || blockRows.length !== draft.teamIds.length || !blockRows.every((r) => r.decisionNeeded)) {
    return { ok: false, code: 'BLOCK_CHANGED' };
  }
  const block = { place: blockRows[0].place, size: blockRows.length };
  if (draft.kind === 'shared' && !sharedPlaceAllowed(tournament, groupId, block)) {
    return { ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' };
  }
  return { ok: true, groupId, block };
}
