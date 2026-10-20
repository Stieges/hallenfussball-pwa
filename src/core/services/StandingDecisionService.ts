/**
 * Schmaler Schreibweg der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2, R-TB-5; @W2A-060, @W2A-061, @W2A-062):
 * 1) frisch lesen, 2) prüfen (`validateDraft`) – schon gültig entschieden → ALREADY_DECIDED, Block nicht mehr offen →
 * BLOCK_CHANGED, 3) nur `standingDecisions` mit Versionsprüfung schreiben. Konflikt → einmal ab 1) neu, dann STALE.
 * Ohne Netz → OFFLINE (F9: in der Tabelle nur mit Netz; ohne Netz geht die Entscheidung mit „Gruppe abschließen“,
 * GA4 A-13b/A-15c). Kein Voll-Speichern (überschriebe sonst Spiele). Rein, ohne React.
 *
 * TB-3': Zurücknehmen (`withdraw`) jeder Art – Annahme, Strafstoßschießen, Reihenfolge – bis zum Abschluss der Gruppe
 * (Daniel K6, @W2A-070), danach WITHDRAW_NOT_ALLOWED. „Gruppe abgeschlossen“ ist eine Pflicht-Abhängigkeit
 * (`groupClosed`, ohne Voreinstellung); bis GA4 A-13 gilt die Zwischenregel `groupClosedByFollowUp` (Spiel mit Herkunft
 * aus der Gruppe besetzt oder angepfiffen, Review A1). Person und Zeit speichert der Dienst nicht im
 * öffentlich lesbaren `config` (@W2A-072); sie gehören ins Verlaufsprotokoll (GA4 A-13b).
 */
import type { StandingDecision, Tournament } from '../../types/tournament';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import { NetworkError, OptimisticLockError, RepositoryError } from '../errors';
import { sortedIds, decisionBasis, type DecisionDraft, type DecisionErrorCode } from '../standings/decisions';
import { validateDraft } from '../standings/validateDraft';
import { tableInput } from '../standings/tournamentTable';

export type DecideResult =
  | { ok: true; decision: StandingDecision }
  | { ok: false; code: DecisionErrorCode };

export type WithdrawResult =
  | { ok: true }
  | { ok: false; code: 'WITHDRAW_NOT_ALLOWED' | 'STALE' | 'OFFLINE' };

export interface StandingDecisionDeps {
  /** Kennung neuer Entscheidungen (ohne Angabe: UUID). */
  newId?: () => string;
  /** Ist die Gruppe abgeschlossen? Pflicht: bis GA4 A-13 `groupClosedByFollowUp`, danach der echte Zustand. */
  groupClosed: (tournament: Tournament, groupId: string) => boolean;
}

const MAX_ATTEMPTS = 2;

type WriteOutcome = 'ok' | 'conflict' | 'offline';

export class StandingDecisionService {
  constructor(
    private readonly repository: ITournamentRepository,
    private readonly deps: StandingDecisionDeps,
  ) {}

  async decide(tournamentId: string, draft: DecisionDraft): Promise<DecideResult> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tournament = await this.repository.get(tournamentId, { fresh: true });
      if (tournament === null) {
        return { ok: false, code: 'BLOCK_CHANGED' };
      }
      const check = validateDraft(draft, tournament);
      if (!check.ok) {
        return check;
      }
      const input = tableInput(tournament.teams, tournament.matches, tournament, check.groupId);
      const decision: StandingDecision = {
        id: this.deps.newId?.() ?? crypto.randomUUID(),
        groupId: check.groupId, // aus der gerechneten Tabelle (Review TB-A Auflage 1)
        teamIds: sortedIds(draft.teamIds),
        order: [...draft.order],
        kind: draft.kind,
        ...(draft.kind === 'shootout' && draft.shootout !== undefined ? { shootout: { ...draft.shootout } } : {}),
        basis: decisionBasis(input, draft.teamIds),
      };
      const outcome = await this.write(tournament, [...(tournament.standingDecisions ?? []), decision]);
      if (outcome === 'ok') {
        return { ok: true, decision };
      }
      if (outcome === 'offline') {
        return { ok: false, code: 'OFFLINE' };
      }
    }
    return { ok: false, code: 'STALE' };
  }

  /** Nimmt eine Entscheidung zurück; ist sie schon weg (anderes Gerät), bleibt es ohne Schreiben dabei. */
  async withdraw(tournamentId: string, decisionId: string): Promise<WithdrawResult> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const tournament = await this.repository.get(tournamentId, { fresh: true });
      if (tournament === null) {
        return { ok: false, code: 'STALE' }; // nichts gelesen – kein Zurücknehmen vortäuschen (Review A5)
      }
      const decisions = tournament.standingDecisions ?? [];
      const decision = decisions.find((d) => d.id === decisionId);
      if (decision === undefined) {
        return { ok: true };
      }
      if (this.deps.groupClosed(tournament, decision.groupId)) {
        return { ok: false, code: 'WITHDRAW_NOT_ALLOWED' };
      }
      const outcome = await this.write(tournament, decisions.filter((d) => d.id !== decisionId));
      if (outcome === 'ok') {
        return { ok: true };
      }
      if (outcome === 'offline') {
        return { ok: false, code: 'OFFLINE' };
      }
    }
    return { ok: false, code: 'STALE' };
  }

  /** Schreibt nur `standingDecisions` gegen die gelesene Version. */
  private async write(tournament: Tournament, decisions: StandingDecision[]): Promise<WriteOutcome> {
    if (this.repository.updateStandingDecisions === undefined) {
      throw new RepositoryError('updateStandingDecisions', 'Repository kann keine Entscheidungen speichern');
    }
    try {
      await this.repository.updateStandingDecisions(tournament.id, decisions, tournament.version ?? 0);
      return 'ok';
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        return 'conflict';
      }
      if (error instanceof NetworkError && error.isOffline) {
        return 'offline';
      }
      throw error;
    }
  }
}
