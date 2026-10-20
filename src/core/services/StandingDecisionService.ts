/**
 * Schmaler Schreibweg der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2, R-TB-5; @W2A-060, @W2A-061, @W2A-062):
 * 1) frisch lesen, 2) prüfen (`validateDraft`) – schon gültig entschieden → ALREADY_DECIDED, Block nicht mehr offen →
 * BLOCK_CHANGED, 3) nur `standingDecisions` mit Versionsprüfung schreiben. Konflikt → einmal ab 1) neu, dann STALE.
 * Ohne Netz → OFFLINE (F9: in der Tabelle nur mit Netz; ohne Netz geht die Entscheidung mit „Gruppe abschließen“,
 * GA4 A-13b/A-15c). Kein Voll-Speichern (überschriebe sonst Spiele). Rein, ohne React.
 */
import type { StandingDecision } from '../../types/tournament';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import { NetworkError, OptimisticLockError, RepositoryError } from '../errors';
import { sortedIds, decisionBasis, type DecisionDraft, type DecisionErrorCode } from '../standings/decisions';
import { validateDraft } from '../standings/validateDraft';
import { tableInput } from '../standings/tournamentTable';

export interface DecisionActor {
  userId: string;
  name: string;
}

export type DecideResult =
  | { ok: true; decision: StandingDecision }
  | { ok: false; code: DecisionErrorCode; by?: string; at?: string };

export interface StandingDecisionDeps {
  now: () => string;
  newId: () => string;
}

const DEFAULT_DEPS: StandingDecisionDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

const MAX_ATTEMPTS = 2;

export class StandingDecisionService {
  constructor(
    private readonly repository: ITournamentRepository,
    private readonly deps: StandingDecisionDeps = DEFAULT_DEPS,
  ) {}

  async decide(tournamentId: string, draft: DecisionDraft, actor: DecisionActor): Promise<DecideResult> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tournament = await this.repository.get(tournamentId, { fresh: true });
      if (tournament === null) {
        return { ok: false, code: 'BLOCK_CHANGED' };
      }
      const check = validateDraft(draft, tournament);
      if (!check.ok) {
        return check;
      }
      const input = tableInput(tournament.teams, tournament.matches, tournament, draft.groupId);
      const decision: StandingDecision = {
        id: this.deps.newId(),
        groupId: draft.groupId,
        teamIds: sortedIds(draft.teamIds),
        order: [...draft.order],
        kind: draft.kind,
        ...(draft.kind === 'shootout' && draft.shootout !== undefined ? { shootout: { ...draft.shootout } } : {}),
        ...(draft.kind !== 'shootout' && draft.reason !== undefined ? { reason: draft.reason.trim() } : {}),
        decidedBy: { userId: actor.userId, name: actor.name },
        decidedAt: this.deps.now(),
        basis: decisionBasis(input, draft.teamIds),
      };
      if (this.repository.updateStandingDecisions === undefined) {
        throw new RepositoryError('updateStandingDecisions', 'Repository kann keine Entscheidungen speichern');
      }
      try {
        await this.repository.updateStandingDecisions(
          tournamentId, [...(tournament.standingDecisions ?? []), decision], tournament.version ?? 0,
        );
        return { ok: true, decision };
      } catch (error) {
        if (error instanceof OptimisticLockError) {
          continue;
        }
        if (error instanceof NetworkError && error.isOffline) {
          return { ok: false, code: 'OFFLINE' };
        }
        throw error;
      }
    }
    return { ok: false, code: 'STALE' };
  }
}
