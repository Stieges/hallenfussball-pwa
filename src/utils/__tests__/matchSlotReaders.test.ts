/**
 * A-03 (MVP-Bauplan, Spur A) – Leser in src/utils lesen die Spielseiten aus den Slots.
 * Eine Seite zählt nur über ihre Team-ID: offene Seiten, fehlende Slots und Namen im Übergangsfeld
 * `teamA/teamB` ergeben nie eine Zuordnung (@TM-033), besetzte Seiten schon (@TM-034).
 */
import { describe, it, expect } from 'vitest';
import { filterMatches } from '../filterMatches';
import { getTeamMatches, analyzeTeamMatches, deleteTeamSafely } from '../teamHelpers';
import { scheduleFingerprint } from '../scheduleFingerprint';
import { calculateFinalsPlacement, getMatchWinner, getMergedFinalRanking, calculateStandings } from '../calculations';
import { DEFAULT_FILTERS } from '../../types/scheduleFilters';
import type { Match, Team, Tournament } from '../../types/tournament';
import { createMockTournament } from '../../test/factories';
import { teamSlot } from '../../core/models/matchSlot';
import { vs, slots, groupRank, resultOf, testUuid } from '../../test/matchSlotFixtures';

const [NORD, UFER, WALD, STEIN] = [1, 2, 3, 4].map(testUuid);
const teams: Team[] = [
  { id: NORD, name: 'FC Nord', group: 'A' },
  { id: UFER, name: 'VfB Ufer', group: 'A' },
  { id: WALD, name: 'SV Wald', group: 'B' },
  { id: STEIN, name: 'TuS Stein', group: 'B' },
];
const m = (id: string, sides: Pick<Match, 'teamA' | 'teamB' | 'slotA' | 'slotB'>, extra: Partial<Match> = {}): Match => ({
  id, round: 1, field: 1, ...sides, ...extra,
});
const tournamentOf = (matches: Match[]): Tournament => createMockTournament({ teams, matches, groupSystem: 'groupsAndFinals' });

describe('filterMatches – Teamsuche über den Slot', () => {
  const filters = { ...DEFAULT_FILTERS, teamSearch: 'nord' };

  it('@TM-034 findet das Spiel über den Namen des Teams, dessen ID im Slot steht', () => {
    const matches = [m('a', vs(NORD, UFER)), m('b', vs(WALD, STEIN))];
    expect(filterMatches(matches, filters, teams).map((x) => x.id)).toEqual(['a']);
  });

  it('@TM-033 Gegenbeispiel: ein Name im Übergangsfeld teamA ohne passenden Slot findet nichts', () => {
    const decoy = m('a', { teamA: 'FC Nord', teamB: 'VfB Ufer', slotA: vs(WALD, STEIN).slotA, slotB: vs(WALD, STEIN).slotB });
    expect(filterMatches([decoy], filters, teams)).toEqual([]);
  });

  it('@TM-033 Gegenbeispiel: eine offene Seite ist kein Treffer, die besetzte Seite schon', () => {
    const open = m('a', slots(groupRank('A', 1), teamSlot(NORD)));
    expect(filterMatches([open], filters, teams).map((x) => x.id)).toEqual(['a']);
    expect(filterMatches([open], { ...DEFAULT_FILTERS, teamSearch: 'ufer' }, teams)).toEqual([]);
  });
});

describe('teamHelpers – Spiele eines Teams über den Slot', () => {
  it('@TM-034 getTeamMatches findet besetzte und aufgelöste Seiten', () => {
    const resolved = m('c', { teamA: NORD, teamB: WALD, slotA: vs(NORD, WALD).slotA, slotB: groupRank('B', 1) });
    const matches = [m('a', vs(NORD, UFER)), m('b', vs(WALD, STEIN)), resolved];
    expect(getTeamMatches(matches, NORD).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('@TM-033 Gegenbeispiel: offene Seiten und der Teamname zählen nicht als Spiel des Teams', () => {
    const open = m('a', slots(groupRank('A', 1), groupRank('B', 1)));
    const byName = m('b', { teamA: 'FC Nord', teamB: NORD, slotA: vs(WALD, STEIN).slotA, slotB: vs(WALD, STEIN).slotB });
    expect(getTeamMatches([open, byName], NORD)).toEqual([]);
  });

  it('@TM-034 analyzeTeamMatches trennt Spiele mit und ohne Ergebnis', () => {
    const matches = [m('a', vs(NORD, UFER), { scoreA: 1, scoreB: 0 }), m('b', vs(NORD, WALD))];
    const analysis = analyzeTeamMatches(teams[0], matches);
    expect(analysis).toMatchObject({ totalMatches: 2, matchesWithResultsIds: ['a'], matchesWithoutResultsIds: ['b'] });
  });

  it('@TM-034 deleteTeamSafely entfernt ein Team ohne Ergebnisse samt seiner Spiele, nicht die anderen', () => {
    const t = tournamentOf([m('a', vs(NORD, UFER)), m('b', vs(WALD, STEIN))]);
    const result = deleteTeamSafely(t, NORD);
    expect(result.updatedMatches.map((x) => x.id)).toEqual(['b']);
    expect(result.updatedTeams.some((x) => x.id === NORD)).toBe(false);
  });
});

describe('scheduleFingerprint – Slots statt Übergangsfeld', () => {
  it('@TM-034 eine Auflösung (offen → Team) ändert den Fingerprint', () => {
    const source = { kind: 'groupRank', group: 'A', rank: 1 } as const;
    const open = tournamentOf([m('a', slots(groupRank('A', 1), groupRank('B', 1)))]);
    const occupied = tournamentOf([m('a', slots(teamSlot(NORD), groupRank('B', 1)))]);
    const resolved = tournamentOf([m('a', slots(teamSlot(NORD, source), groupRank('B', 1)))]);
    expect(scheduleFingerprint(open)).not.toBe(scheduleFingerprint(occupied));
    expect(scheduleFingerprint(occupied)).not.toBe(scheduleFingerprint(resolved));
  });

  it('@TM-033 Gegenbeispiel: ein anderer Text im Übergangsfeld teamA ändert den Fingerprint nicht', () => {
    const a = tournamentOf([m('a', vs(NORD, UFER))]);
    const b = tournamentOf([m('a', { ...vs(NORD, UFER), teamA: 'irgendein Text' })]);
    expect(scheduleFingerprint(a)).toBe(scheduleFingerprint(b));
  });

  it('@TM-034 ein Spielplan ohne Slots ergibt einen stabilen Fingerprint', () => {
    const noSlots = tournamentOf([{ id: 'a', round: 1, field: 1, teamA: NORD, teamB: UFER }]);
    expect(scheduleFingerprint(noSlots)).toBe(scheduleFingerprint(noSlots));
  });
});

describe('getMatchWinner / calculateFinalsPlacement – Sieger aus den Slots', () => {
  const final = (extra: Partial<Match>): Match =>
    m('f', vs(NORD, WALD), { isFinal: true, finalType: 'final', ...extra });

  it.each<[string, Partial<Match>, TeamIdPair | null]>([
    ['@TM-034 Sieger nach regulärer Spielzeit (Heim)', { scoreA: 2, scoreB: 1 }, { winner: NORD, loser: WALD }],
    ['@TM-034 Sieger nach regulärer Spielzeit (Gast)', { scoreA: 0, scoreB: 1 }, { winner: WALD, loser: NORD }],
    ['@TM-034 Sieger nach Verlängerung', { scoreA: 1, scoreB: 1, decidedBy: 'overtime', overtimeScoreA: 0, overtimeScoreB: 1 }, { winner: WALD, loser: NORD }],
    ['@TM-034 Sieger nach Golden Goal (Heim)', { scoreA: 1, scoreB: 1, decidedBy: 'goldenGoal', overtimeScoreA: 1, overtimeScoreB: 0 }, { winner: NORD, loser: WALD }],
    ['@TM-034 Sieger nach Strafstoßschießen', { scoreA: 1, scoreB: 1, decidedBy: 'penalty', penaltyScoreA: 4, penaltyScoreB: 5 }, { winner: WALD, loser: NORD }],
    ['@TM-034 Sieger nach Strafstoßschießen (Heim)', { scoreA: 1, scoreB: 1, decidedBy: 'penalty', penaltyScoreA: 5, penaltyScoreB: 4 }, { winner: NORD, loser: WALD }],
    ['@TM-033 Gegenbeispiel: Unentschieden ohne Entscheidung hat keinen Sieger', { scoreA: 1, scoreB: 1 }, null],
    ['@TM-033 Gegenbeispiel: ohne Ergebnis kein Sieger', {}, null],
  ])('%s', (_name, extra, expected) => {
    expect(getMatchWinner(final(extra))).toEqual(expected);
  });

  it('@TM-033 Gegenbeispiel: eine offene Seite hat keinen Sieger, auch wenn die Tore eindeutig sind', () => {
    const open = m('f', slots(teamSlot(NORD), resultOf(testUuid(500), 'winner')), { scoreA: 3, scoreB: 0, isFinal: true });
    expect(getMatchWinner(open)).toBeNull();
  });

  it('@TM-034 Platzierungen: Finale und Spiel um Platz 3 über Team-IDs', () => {
    const matches = [
      final({ scoreA: 2, scoreB: 1 }),
      m('t', vs(UFER, STEIN), { isFinal: true, finalType: 'thirdPlace', scoreA: 0, scoreB: 3 }),
    ];
    const result = calculateFinalsPlacement(teams, matches, []);
    expect(result.placements.map((p) => [p.rank, p.team.id])).toEqual([[1, NORD], [2, WALD], [3, STEIN], [4, UFER]]);
    expect(result.playoffStatus).toBe('completed');
  });

  it('@TM-033 Gegenbeispiel: Team {id:t2, name:t1} wird nicht über den Namen als Sieger gefunden', () => {
    const tricky: Team[] = [{ id: NORD, name: WALD }, { id: WALD, name: NORD }];
    const result = calculateFinalsPlacement(tricky, [final({ scoreA: 2, scoreB: 1 })], []);
    expect(result.placements.find((p) => p.rank === 1)?.team.id).toBe(NORD);
  });

  it('@TM-034 getMergedFinalRanking hängt die übrigen Teams aus der Gruppentabelle an', () => {
    const matches = [final({ scoreA: 2, scoreB: 1 })];
    const standings = calculateStandings(teams, matches, tournamentOf(matches));
    const { ranking } = getMergedFinalRanking(teams, matches, standings, tournamentOf(matches));
    expect(ranking.slice(0, 2).map((p) => p.team.id)).toEqual([NORD, WALD]);
    expect(ranking).toHaveLength(4);
  });
});

interface TeamIdPair { winner: string; loser: string }
