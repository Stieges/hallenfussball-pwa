/**
 * Test-Hilfen Paket TB, Task TB-3/TB-3' und GA4 A-13b-C: Repository-Attrappe mit echter Versionslogik (Entscheidungen wie
 * `record_standing_decision`: Versionsprüfung `STALE`, Verlauf mit Person und Zeit, Abschluss `complete_group`), Lage aus
 * @W2A-048 mit zwei Gruppen und Halbfinals, Nikolaus-Lage (@W2A-067) mit Einstellung „Diese Plätze müssen bei Gleichstand
 * ausgespielt werden“. Nur Testumgebung.
 */
import type { BracketLogEntry, Match, Tournament } from '../../../types/tournament';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type {
  CompleteGroupRequest, CompleteGroupResult, RecordDecisionRequest, RecordDecisionResult, ReopenGroupResult,
} from '../../repositories/groupCompletionCloud';
import { applyCompleteGroup, applyRecordDecision, applyReopenGroup } from '../../repositories/localGroupCompletion';
import { NetworkError, OptimisticLockError } from '../../errors';
import { StandingDecisionService } from '../../services/StandingDecisionService';
import { prepareGroupCompletion } from '../../services/GroupCompletionService';
import { groupClosedFromCompletions } from '../groupCompletions';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import { BFV_ORDER, DATA, id, league, parseMatches, POINTS_310, teamsOf, type Key } from './fixtures';

const copy = (t: Tournament): Tournament => JSON.parse(JSON.stringify(t)) as Tournament;

/** Repository-Attrappe: hält ein Turnier, schreibt Entscheidungen nur bei passender Version und führt den Verlauf wie der Server. */
export class MemoryRepo {
  tournament: Tournament;
  online = true;
  writes = 0;
  /** Vorab eingereihte (veraltete) Lesestände – simuliert „hat Version v gelesen, bevor jemand schrieb“. */
  staleReads: Tournament[] = [];
  /** Person, die der Server aus der Anmeldung liest und im Verlauf nennt. */
  author: string | undefined = 'Olli';
  private idSeq = 0;
  /** Fehler, den der nächste Schreibversuch wirft (etwa `RetryLaterError`), einmalig. */
  failNextWith: Error | undefined;

  constructor(tournament: Tournament) {
    this.tournament = copy({ ...tournament, version: tournament.version ?? 1 });
  }

  get(): Promise<Tournament | null> {
    const stale = this.staleReads.shift();
    return Promise.resolve(copy(stale ?? this.tournament));
  }

  /** Fehler, der den Schreibversuch trifft (kein Netz oder der vorgegebene), sonst `undefined`. */
  private blocked(): Error | undefined {
    if (!this.online) {
      return new NetworkError('ohne Netz', true);
    }
    const error = this.failNextWith;
    this.failNextWith = undefined;
    return error;
  }

  private log(entry: Omit<BracketLogEntry, 'id' | 'at' | 'actorName'>): void {
    const log = this.tournament.decisionLog ?? [];
    this.tournament = {
      ...this.tournament,
      decisionLog: [...log, { ...entry, id: log.length + 1, at: new Date().toISOString(), ...(this.author !== undefined ? { actorName: this.author } : {}) }],
    };
  }

  /** Wie `record_standing_decision`: Entscheidung (ohne Person/Zeit/Grund) im Turnier, Person, Zeit und Grund im Verlauf. */
  recordStandingDecision(_id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> {
    const blocked = this.blocked();
    if (blocked !== undefined) {
      return Promise.reject(blocked);
    }
    const before = this.tournament.standingDecisions ?? [];
    const { tournament, result } = applyRecordDecision(this.tournament, request, expectedVersion);
    if (tournament !== undefined) {
      this.tournament = copy(tournament);
      this.writes++;
      if (request.action === 'decide') {
        const { basis: _basis, ...detail } = request.decision;
        this.log({ kind: 'standing_decision', groupId: request.decision.groupId, detail, ...(request.decision.kind === 'order' && request.reason !== undefined ? { reason: request.reason } : {}) });
      } else {
        const gone = before.find((d) => d.id === request.decision.id);
        this.log({ kind: 'standing_withdraw', ...(gone !== undefined ? { groupId: gone.groupId } : {}), detail: { id: request.decision.id } });
      }
    }
    return Promise.resolve(result);
  }

  /** Wie `complete_group` (ohne Besetzung der Folgespiele): Abschluss eintragen, Verlauf führen. */
  completeGroup(_id: string, request: CompleteGroupRequest): Promise<CompleteGroupResult> {
    const blocked = this.blocked();
    if (blocked !== undefined) {
      return Promise.reject(blocked);
    }
    const { tournament, result } = applyCompleteGroup(this.tournament, request);
    if (tournament !== undefined) {
      this.tournament = copy(tournament);
      this.log({ kind: 'complete_group', groupId: request.groupId, detail: { ranking: [...request.ranking], openRanks: [...request.openRanks] } });
    }
    return Promise.resolve(result);
  }

  reopenGroup(_id: string, groupId: string, reason: string): Promise<ReopenGroupResult> {
    const blocked = this.blocked();
    if (blocked !== undefined) {
      return Promise.reject(blocked);
    }
    const { tournament, result } = applyReopenGroup(this.tournament, groupId);
    if (tournament !== undefined) {
      this.tournament = copy(tournament);
      this.log({ kind: 'reopen_group', groupId, detail: {}, reason });
    }
    return Promise.resolve(result);
  }

  readBracketLog(): Promise<BracketLogEntry[] | undefined> {
    return Promise.resolve(this.tournament.decisionLog);
  }

  /** Schmaler Weg der Einstellung „Plätze ausspielen“: nur dieses Feld, mit Versionsprüfung (nie `standingDecisions` überschreiben). */
  updatePlacementsToPlayOut(_id: string, places: number[], expectedVersion: number): Promise<void> {
    if (!this.online) {
      return Promise.reject(new NetworkError('ohne Netz', true));
    }
    if ((this.tournament.version ?? 0) !== expectedVersion) {
      return Promise.reject(new OptimisticLockError('Turnier-Daten wurden zwischenzeitlich verändert.'));
    }
    this.tournament = { ...this.tournament, placementsToPlayOut: [...places], version: expectedVersion + 1 };
    this.writes++;
    return Promise.resolve();
  }

  /** Korrektur eines Spiels „H–G“ an der Attrappe vorbei (wie ein Eintrag über die Spielsteuerung). */
  correct(home: Key, away: Key, scoreA: number, scoreB: number): void {
    this.tournament = {
      ...this.tournament,
      version: (this.tournament.version ?? 0) + 1,
      matches: this.tournament.matches.map((m) => (isPairing(m, home, away) ? { ...m, scoreA, scoreB } : m)),
    };
  }

  /** Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“ ändern (wie in den Turnierregeln). */
  setPlaces(places: number[]): void {
    this.tournament = { ...this.tournament, placementsToPlayOut: [...places], version: (this.tournament.version ?? 0) + 1 };
  }

  /** `groupClosed`: ob die Gruppe abgeschlossen ist; ohne Angabe der echte Zustand aus den Abschlüssen (`groupClosedFromCompletions`). */
  service(ids: string[] = [], groupClosed?: (groupId: string) => boolean): StandingDecisionService {
    let n = 0;
    // Kennungen sind je Attrappe eindeutig (der Server lehnt eine doppelte Kennung ab, DUPLICATE_ID)
    return new StandingDecisionService(this as unknown as ITournamentRepository, {
      newId: () => ids[n++] ?? `entscheidung-${String(++this.idSeq)}`,
      groupClosed: groupClosed === undefined ? groupClosedFromCompletions : (_t: Tournament, groupId: string) => groupClosed(groupId),
    });
  }
}

const isPairing = (m: Match, home: Key, away: Key): boolean =>
  m.slotA.kind === 'team' && m.slotA.teamId === id(home) && m.slotB.kind === 'team' && m.slotB.teamId === id(away);

/** Strafstoßschießen x:y für `winner` gegen `loser` (Entwurf wie aus dem Dialog). */
export const shootout = (winner: Key, loser: Key, w: number, l: number, groupId = '') => ({
  groupId, teamIds: [id(winner), id(loser)], order: [id(winner), id(loser)], kind: 'shootout' as const, shootout: { winner: w, loser: l },
});

/** Reihenfolge mit Grund (3+ Teams). */
export const order = (keys: Key[], reason: string, groupId = '') => ({
  groupId, teamIds: keys.map(id), order: keys.map(id), kind: 'order' as const, reason,
});

/** „Ergebnis so akzeptieren“ – ohne Grund, ein Tipp (Daniel B4d). */
export const shared = (keys: Key[], groupId = '') => ({
  groupId, teamIds: keys.map(id), order: keys.map(id), kind: 'shared' as const,
});

/** Lage aus @W2A-048: Gruppe A (Süd/West gleich auf 2 und 3), Gruppe B ohne Gleichstand, Halbfinals mit Herkunft. */
export function lage048(): Tournament {
  const a = parseMatches(DATA.W2A_048_A, { group: 'A', idPrefix: 'a' });
  const b = parseMatches('M–B 2:0; M–U 2:0; M–T 2:0; B–U 2:1; B–T 1:0; U–T 1:0', { group: 'B', idPrefix: 'b' });
  const semis: Match[] = [
    { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', label: 'Halbfinale 1', ...slots(groupRank('A', 1), groupRank('B', 2)) },
    { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', label: 'Halbfinale 2', ...slots(groupRank('B', 1), groupRank('A', 2)) },
  ];
  return createMockTournament({
    teams: [...teamsOf('NSWO', 'A'), ...teamsOf('MBUT', 'B')],
    matches: [...a, ...b, ...semis],
    pointSystem: POINTS_310,
    placementLogic: BFV_ORDER,
    groupSystem: 'groupsAndFinals',
    version: 1,
  });
}

/** Privates Turnier „Jeder gegen jeden“ aus Abschnitt-6-Daten; `places` = auszuspielende Plätze (ohne: Voreinstellung). */
export const jgj = (keys: string, results: string, places?: number[]): Tournament => ({
  ...league(keys, results).tournament, version: 1, ...(places !== undefined ? { placementsToPlayOut: places } : {}),
});

/** Nikolaus-Lage (@W2A-067): eine Gruppe, 6 Teams, alle 15 Spiele entschieden; Petting und Otting gleich auf Platz 3. */
export const nikolaus = (places?: number[]): Tournament => jgj('KRPDFX', DATA.NIKOLAUS, places);

/** „Gruppe abschließen“ über die Attrappe, wie die Oberfläche es aus `prepareGroupCompletion` täte (A-13c). Wirft, wenn die Gruppe nicht bereit ist. */
export async function closeGroup(repo: MemoryRepo, groupId: string): Promise<void> {
  const prepared = prepareGroupCompletion(repo.tournament, groupId);
  if (prepared.code !== 'READY') {
    throw new Error(`Gruppe '${groupId}' nicht abschließbar: ${prepared.code}`);
  }
  const result = await repo.completeGroup(repo.tournament.id, {
    groupId,
    ranking: prepared.ranking,
    openRanks: prepared.openRanks,
    tieDecisions: prepared.tieDecisions,
    knownDecisionIds: (repo.tournament.standingDecisions ?? []).map((d) => d.id),
    expectedState: prepared.expectedState,
  });
  if (result.status !== 'ok') {
    throw new Error(`Abschluss abgelehnt: ${result.status}`);
  }
}
