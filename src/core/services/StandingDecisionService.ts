/**
 * Schmaler Schreibweg der Gleichstands-Entscheidung (Paket TB, Plan v2 § 3.2, R-TB-5; @W2A-060, @W2A-061, @W2A-062):
 * 1) frisch lesen, 2) prüfen (`validateDraft`) – schon gültig entschieden → ALREADY_DECIDED (mit Person aus dem Verlauf),
 * Block nicht mehr offen → BLOCK_CHANGED, 3) über `record_standing_decision` schreiben (GA4 A-13b-C, R-GA4v2-1): Entscheidung
 * und Verlauf in einer Transaktion, mit Versionsprüfung. Konflikt (`STALE`) → einmal ab 1) neu, dann STALE. Ohne Netz → OFFLINE
 * (F9: in der Tabelle nur mit Netz; ohne Netz geht die Entscheidung mit „Gruppe abschließen“, A-15c). Verklemmung oder
 * Wartezeit am Server (`RetryLaterError`, `40P01`/`55P03`) → RETRY_LATER: nichts geschrieben, neuer Versuch erlaubt. Kein
 * Voll-Speichern (überschriebe sonst Spiele). Rein, ohne React.
 *
 * Zurücknehmen (`withdraw`) jeder Art – Annahme, Strafstoßschießen, Reihenfolge – bis zum Abschluss der Gruppe (Daniel K6,
 * @W2A-070), danach WITHDRAW_NOT_ALLOWED. „Gruppe abgeschlossen“ ist eine Pflicht-Abhängigkeit (`groupClosed`, ohne
 * Voreinstellung): in der App `groupClosedFromCompletions` (echter Abschluss-Zustand, `StandingTieProvider`). Person und Zeit
 * speichert der Dienst nie im öffentlich lesbaren `config` (@W2A-072); sie stehen im Verlauf (`Tournament.decisionLog`).
 */
import type { StandingDecision, Tournament } from '../../types/tournament';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import { NetworkError, RepositoryError, RetryLaterError } from '../errors';
import { sortedIds, decisionBasis, type DecisionDraft, type DecisionErrorCode } from '../standings/decisions';
import { validateDraft } from '../standings/validateDraft';
import { tableInput } from '../standings/tournamentTable';
import { decidedBy } from '../standings/decisionLog';
import { checkedVersion } from '../repositories/confirmedVersion';
import type { RecordDecisionRejection, RecordDecisionRequest } from '../repositories/groupCompletionCloud';

export type DecideResult =
  | { ok: true; decision: StandingDecision }
  /** `by`: bei ALREADY_DECIDED der Name der Person, die schon entschieden hat (aus dem Verlauf; fehlt ohne Verlauf, @W2A-060). */
  | { ok: false; code: DecisionErrorCode; by?: string };

export type WithdrawResult =
  | { ok: true }
  | { ok: false; code: 'WITHDRAW_NOT_ALLOWED' | 'STALE' | 'OFFLINE' | 'RETRY_LATER' };

export interface StandingDecisionDeps {
  /** Kennung neuer Entscheidungen (ohne Angabe: UUID). */
  newId?: () => string;
  /** Ist die Gruppe abgeschlossen? Pflicht, ohne Voreinstellung: in der App der echte Zustand `groupClosedFromCompletions`. */
  groupClosed: (tournament: Tournament, groupId: string) => boolean;
}

const MAX_ATTEMPTS = 2;

type WriteOutcome = 'ok' | 'conflict' | 'OFFLINE' | 'RETRY_LATER' | 'REASON_REQUIRED' | 'WITHDRAW_NOT_ALLOWED';

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
        const by = check.decisionId === undefined ? undefined : decidedBy(tournament, check.decisionId)?.name;
        return { ok: false, code: check.code, ...(by !== undefined ? { by } : {}) };
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
      // Der Grund einer Reihenfolge geht nur an den Verlauf, nie ins `config` (@W2A-072); die Kennung ist neu (UUID).
      const outcome = await this.write(tournament, { action: 'decide', decision, ...(draft.kind === 'order' && draft.reason !== undefined ? { reason: draft.reason.trim() } : {}) });
      if (outcome === 'ok') {
        return { ok: true, decision };
      }
      if (outcome !== 'conflict') {
        return { ok: false, code: outcome };
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
      const decision = (tournament.standingDecisions ?? []).find((d) => d.id === decisionId);
      if (decision === undefined) {
        return { ok: true };
      }
      if (this.deps.groupClosed(tournament, decision.groupId)) {
        return { ok: false, code: 'WITHDRAW_NOT_ALLOWED' };
      }
      const outcome = await this.write(tournament, { action: 'withdraw', decision: { id: decisionId } });
      if (outcome === 'ok') {
        return { ok: true };
      }
      if (outcome === 'WITHDRAW_NOT_ALLOWED' || outcome === 'OFFLINE' || outcome === 'RETRY_LATER') {
        return { ok: false, code: outcome };
      }
      if (outcome !== 'conflict') {
        throw new RepositoryError('recordStandingDecision', `Zurücknehmen vom Server nicht angenommen: ${outcome}`);
      }
    }
    return { ok: false, code: 'STALE' };
  }

  /**
   * Schreibt über `record_standing_decision` gegen die zuletzt vom Server bestätigte Version der gelesenen Kopie
   * (`checkedVersion`, Befund C-ENTSCHEIDUNG-GEGEN-ANZEIGEVERSION, @W2A-060): nie gegen die lokal gestempelte Version – die
   * kann nach einer fremden Änderung dieselbe Zahl tragen wie der Server und fremde Entscheidungen still überschreiben.
   */
  private async write(tournament: Tournament, request: RecordDecisionRequest): Promise<WriteOutcome> {
    if (this.repository.recordStandingDecision === undefined) {
      throw new RepositoryError('recordStandingDecision', 'Repository kann keine Entscheidungen speichern');
    }
    try {
      const result = await this.repository.recordStandingDecision(tournament.id, request, checkedVersion(tournament) ?? 0);
      if (result.status === 'ok') {
        return 'ok';
      }
      if (result.status === 'forbidden') {
        throw new RepositoryError('recordStandingDecision', 'keine Berechtigung');
      }
      return rejectionOutcome(result.code, request.action);
    } catch (error) {
      if (error instanceof NetworkError && error.isOffline) {
        return 'OFFLINE';
      }
      if (error instanceof RetryLaterError) {
        return 'RETRY_LATER';
      }
      throw error;
    }
  }
}

/** Ablehnung des Servers → Ergebnis des Dienstes. Eine schon fehlende Entscheidung beim Zurücknehmen ist erledigt. */
function rejectionOutcome(code: RecordDecisionRejection, action: RecordDecisionRequest['action']): WriteOutcome {
  switch (code) {
    case 'STALE': return 'conflict';
    case 'NOT_FOUND':
      if (action === 'withdraw') {
        return 'ok';
      }
      throw new RepositoryError('recordStandingDecision', 'Vom Server nicht angenommen: NOT_FOUND');
    case 'REASON_REQUIRED': return 'REASON_REQUIRED';
    case 'WITHDRAW_NOT_ALLOWED': return 'WITHDRAW_NOT_ALLOWED';
    default: throw new RepositoryError('recordStandingDecision', `Vom Server nicht angenommen: ${code}`);
  }
}
