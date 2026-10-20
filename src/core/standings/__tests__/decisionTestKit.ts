/**
 * Test-Hilfen Paket TB, Task TB-3: Repository-Attrappe mit echter Versionslogik (Optimistic Lock wie
 * `SupabaseRepository`), Personen aus dem Gherkin, Lage aus @W2A-048 mit zwei Gruppen und Halbfinals. Nur Testumgebung.
 */
import type { Match, StandingDecision, Tournament } from '../../../types/tournament';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import { NetworkError, OptimisticLockError } from '../../errors';
import { StandingDecisionService, type DecisionActor } from '../../services/StandingDecisionService';
import { createMockTournament } from '../../../test/factories';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import { BFV_ORDER, DATA, id, league, parseMatches, POINTS_310, teamsOf, type Key } from './fixtures';

export const OLLI: DecisionActor = { userId: 'user-olli', name: 'Olli' };
export const MARIA: DecisionActor = { userId: 'user-maria', name: 'Maria' };

const copy = (t: Tournament): Tournament => JSON.parse(JSON.stringify(t)) as Tournament;

/** Repository-Attrappe: hält ein Turnier, schreibt `standingDecisions` nur bei passender Version. */
export class MemoryRepo {
  tournament: Tournament;
  online = true;
  writes = 0;
  /** Vorab eingereihte (veraltete) Lesestände – simuliert „hat Version v gelesen, bevor jemand schrieb“. */
  staleReads: Tournament[] = [];

  constructor(tournament: Tournament) {
    this.tournament = copy({ ...tournament, version: tournament.version ?? 1 });
  }

  get(): Promise<Tournament | null> {
    const stale = this.staleReads.shift();
    return Promise.resolve(copy(stale ?? this.tournament));
  }

  updateStandingDecisions(_id: string, decisions: StandingDecision[], expectedVersion: number): Promise<void> {
    if (!this.online) {
      return Promise.reject(new NetworkError('ohne Netz', true));
    }
    if ((this.tournament.version ?? 0) !== expectedVersion) {
      return Promise.reject(new OptimisticLockError('Turnier-Daten wurden zwischenzeitlich verändert.'));
    }
    const stored = JSON.parse(JSON.stringify(decisions)) as StandingDecision[];
    this.tournament = { ...this.tournament, standingDecisions: stored, version: expectedVersion + 1 };
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

  service(ids: string[] = []): StandingDecisionService {
    let n = 0;
    return new StandingDecisionService(this as unknown as ITournamentRepository, {
      now: () => '2026-12-06T14:32:00.000Z',
      newId: () => ids[n++] ?? `entscheidung-${String(n)}`,
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

/** „gleichen Platz lassen“ mit Grund. */
export const shared = (keys: Key[], reason: string | undefined, groupId = '') => ({
  groupId, teamIds: keys.map(id), order: keys.map(id), kind: 'shared' as const, reason,
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

/** Privates Turnier „Jeder gegen jeden“ aus Abschnitt-6-Daten. */
export const jgj = (keys: string, results: string): Tournament => ({ ...league(keys, results).tournament, version: 1 });
