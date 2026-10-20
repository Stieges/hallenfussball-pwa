/**
 * Prüfung eines Gleichstands-Eintrags gegen das Turnier, ohne zu schreiben (Paket TB, Plan v2 § 3.2): dieselben
 * Prüfungen in der Tabelle (`StandingDecisionService.decide`) und beim Abschluss ohne Netz (GA4 A-13b/A-15c, @TM-146).
 * Reihenfolge: zuerst der Eintrag selbst (Sieger, Reihenfolge, Grund), dann der Stand der Tabelle (schon entschieden,
 * Block geändert, „gleichen Platz lassen“ erlaubt). Rein, ohne React.
 */
import type { Tournament } from '../../types/tournament';
import { checkDraftFields, sameTeamSet, sharedPlaceAllowed, type DecisionDraft, type DecisionErrorCode } from './decisions';
import { rankTournamentGroup } from './tournamentTable';

export type DraftCheck =
  | { ok: true; block: { place: number; size: number } }
  | { ok: false; code: DecisionErrorCode; by?: string; at?: string };

type CheckedTournament = Pick<Tournament, 'teams' | 'matches' | 'pointSystem' | 'placementLogic' | 'standingDecisions'>;

export function validateDraft(draft: DecisionDraft, tournament: CheckedTournament): DraftCheck {
  const fieldError = checkDraftFields(draft);
  if (fieldError !== null) {
    return { ok: false, code: fieldError };
  }
  const table = rankTournamentGroup(tournament, draft.groupId);
  const decided = table.rows.find((r) => r.decision !== undefined && sameTeamSet(r.decision.teamIds, draft.teamIds))?.decision;
  if (decided !== undefined) {
    return { ok: false, code: 'ALREADY_DECIDED', by: decided.decidedBy.name, at: decided.decidedAt };
  }
  const blockRows = table.rows.filter((r) => draft.teamIds.includes(r.team.id));
  const open = table.openTies.some((block) => sameTeamSet(block, draft.teamIds));
  if (!open || blockRows.length !== draft.teamIds.length || !blockRows.every((r) => r.decisionNeeded)) {
    return { ok: false, code: 'BLOCK_CHANGED' };
  }
  const block = { place: blockRows[0].place, size: blockRows.length };
  if (draft.kind === 'shared' && !sharedPlaceAllowed(tournament, draft.groupId, block)) {
    return { ok: false, code: 'SHARED_PLACE_NOT_ALLOWED' };
  }
  return { ok: true, block };
}
