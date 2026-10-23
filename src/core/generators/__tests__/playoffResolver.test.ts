/**
 * A-03 (MVP-Bauplan, Spur A) – Auflösung offener Finalrunden-Seiten auf Slots.
 * Ersetzt src/utils/__tests__/playoffResolver.test.ts (Platzhalter-Texte `group-a-1st`, `semi1-winner`):
 * dieselben Aussagen, jetzt über Slots mit Herkunft und echten Spiel-IDs (UUID statt „semi1“).
 *
 * @TM-033 / @TM-034 (Besetzung): eine Seite ist erst besetzt, wenn ihre Herkunft entschieden ist.
 * GA4 A-13c: Gruppenplätze besetzt der Resolver nie mehr (@TM-044, @TM-016) – nur „Gruppe abschließen" (siehe
 * `groupCompletionPlan.test.ts`, `followUpPlacement.test.ts`, `koSlotResolution.a13c.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { needsPlayoffResolution, resolveBracketAfterPlayoffMatch } from '..';
import type { Match, Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { vs, slots, groupRank, resultOf, testUuid, withStaleSides } from '../../../test/matchSlotFixtures';

const [A1, A2, B1, B2] = [1, 2, 3, 4].map(testUuid);
const SEMI1 = testUuid(201);
const SEMI2 = testUuid(202);
const FINAL = testUuid(203);
const THIRD = testUuid(204);

const teams: Team[] = [
  { id: A1, name: 'Team A1', group: 'A' },
  { id: A2, name: 'Team A2', group: 'A' },
  { id: B1, name: 'Team B1', group: 'B' },
  { id: B2, name: 'Team B2', group: 'B' },
];

const tournamentOf = (matches: Match[]): Tournament =>
  createMockTournament({ teams, matches, groupSystem: 'groupsAndFinals', numberOfFields: 2 });

const groupMatch = (id: string, a: string, b: string, group: string, score?: [number, number]): Match => ({
  id, round: 1, field: 1, group, isFinal: false, ...vs(a, b),
  ...(score ? { scoreA: score[0], scoreB: score[1] } : {}),
});

/** Gruppenphase fertig: A1 schlägt A2, B1 schlägt B2. */
const finishedGroups = (): Match[] => [
  groupMatch(testUuid(301), A1, A2, 'A', [2, 1]),
  groupMatch(testUuid(302), B1, B2, 'B', [3, 0]),
];

/** Kreuz-Halbfinale wie der Generator: HF1 = Zweiter A gegen Erster B, HF2 = Erster A gegen Zweiter B. */
const semis = (): Match[] => [
  { id: SEMI1, round: 2, field: 1, isFinal: true, label: '1. Halbfinale', ...slots(groupRank('A', 2), groupRank('B', 1)) },
  { id: SEMI2, round: 2, field: 2, isFinal: true, label: '2. Halbfinale', ...slots(groupRank('A', 1), groupRank('B', 2)) },
];

const finals = (): Match[] => [
  { id: FINAL, round: 3, field: 1, isFinal: true, finalType: 'final', label: 'Finale', ...slots(resultOf(SEMI1, 'winner'), resultOf(SEMI2, 'winner')) },
  { id: THIRD, round: 3, field: 2, isFinal: true, finalType: 'thirdPlace', label: 'Spiel um Platz 3', ...slots(resultOf(SEMI1, 'loser'), resultOf(SEMI2, 'loser')) },
];

const byId = (t: Tournament, id: string) => t.matches.find((m) => m.id === id);
const idOf = (m: Match | undefined, side: 'A' | 'B') => {
  const slot = side === 'A' ? m?.slotA : m?.slotB;
  return slot?.kind === 'team' ? slot.teamId : undefined;
};

describe('needsPlayoffResolution', () => {
  it('returns false when no playoff matches exist', () => {
    expect(needsPlayoffResolution(tournamentOf(finishedGroups()))).toBe(false);
  });

  it('A-03 returns true when a playoff match has an open side', () => {
    expect(needsPlayoffResolution(tournamentOf(semis()))).toBe(true);
  });

  it('A-03 returns false when both sides of every playoff match are occupied', () => {
    const occupied: Match = { id: FINAL, round: 2, field: 1, isFinal: true, ...vs(A1, B1) };
    expect(needsPlayoffResolution(tournamentOf([occupied]))).toBe(false);
  });

  it('A-03 Gegenbeispiel: ein Platzhaltertext im Übergangsfeld macht eine besetzte Seite nicht offen', () => {
    const occupied: Match = withStaleSides({ id: FINAL, round: 2, field: 1, isFinal: true, ...vs(A1, B1) }, 'group-a-1st', 'TBD');
    expect(needsPlayoffResolution(tournamentOf([occupied]))).toBe(false);
  });
});

// @TM-143 (B-40) / GA4 A-13c @TM-044: Das letzte Gruppenspiel besetzt nichts – weder mit Zwischenstand noch nach dem Abpfiff.
describe('Das letzte Gruppenspiel besetzt keine Gruppenplätze (@TM-044, @TM-143)', () => {
  const gruppenMatches = (letztesSpiel: Partial<Match>): Match[] => [
    { ...groupMatch(testUuid(311), A1, A2, 'A', [1, 0]), matchStatus: 'finished' },
    { ...groupMatch(testUuid(312), A2, A1, 'A', [2, 0]), round: 2, ...letztesSpiel },
    { ...groupMatch(testUuid(313), B1, B2, 'B', [3, 0]), matchStatus: 'finished' },
  ];

  it.each(['running', 'finished'] as const)('@TM-044 letztes Gruppenspiel %s: die Halbfinals zeigen weiter ihre Herkunft', (status) => {
    const t = tournamentOf([...gruppenMatches({ matchStatus: status }), ...semis()]);
    resolveBracketAfterPlayoffMatch(t);
    expect(byId(t, SEMI1)?.slotA?.kind).toBe('pending');
    expect(byId(t, SEMI2)?.slotA?.kind).toBe('pending');
    expect(byId(t, SEMI2)?.slotB?.kind).toBe('pending');
  });
});

describe('resolveBracketAfterPlayoffMatch', () => {
  const playedSemis = (): Match[] => {
    const [s1, s2] = semis();
    return [
      { ...s1, ...vs(A1, A2), scoreA: 2, scoreB: 1 }, // A1 gewinnt
      { ...s2, ...vs(B1, B2), scoreA: 0, scoreB: 3 }, // B2 gewinnt
    ];
  };

  it('@TM-034 resolves final (winners) and third place (losers) after both semifinals', () => {
    const t = tournamentOf([...finishedGroups(), ...playedSemis(), ...finals()]);
    const result = resolveBracketAfterPlayoffMatch(t);

    expect(result?.updatedMatches).toBe(2);
    expect(idOf(byId(t, FINAL), 'A')).toBe(A1);
    expect(idOf(byId(t, FINAL), 'B')).toBe(B2);
    expect(idOf(byId(t, THIRD), 'A')).toBe(A2);
    expect(idOf(byId(t, THIRD), 'B')).toBe(B1);
    expect(byId(t, FINAL)?.slotA).toEqual({
      kind: 'team',
      teamId: A1,
      resolvedFrom: { kind: 'matchResult', matchId: SEMI1, role: 'winner' },
    });
  });

  it('@TM-033 Gegenbeispiel: die Verlierer-Seite bekommt nicht den Sieger', () => {
    const t = tournamentOf([...finishedGroups(), ...playedSemis(), ...finals()]);
    resolveBracketAfterPlayoffMatch(t);
    expect(idOf(byId(t, THIRD), 'A')).not.toBe(A1);
    expect(idOf(byId(t, THIRD), 'B')).not.toBe(B2);
  });

  it('@TM-033 does not resolve the final when semifinals have no scores yet', () => {
    const [s1, s2] = semis();
    const t = tournamentOf([...finishedGroups(), { ...s1, ...vs(A1, A2) }, { ...s2, ...vs(B1, B2) }, ...finals()]);
    const result = resolveBracketAfterPlayoffMatch(t);
    expect(result?.wasResolved).toBe(false);
    expect(byId(t, FINAL)?.slotA?.kind).toBe('pending');
  });

  it('@TM-034 Halbfinale 1:1, Strafstoßschießen 4:3 besetzt Finale (Sieger) und Spiel um Platz 3 (Verlierer)', () => {
    const [s1, s2] = playedSemis();
    const shootout = { ...s1, scoreA: 1, scoreB: 1, decidedBy: 'penalty' as const, penaltyScoreA: 4, penaltyScoreB: 3 };
    const t = tournamentOf([...finishedGroups(), shootout, s2, ...finals()]);
    resolveBracketAfterPlayoffMatch(t);
    expect(idOf(byId(t, FINAL), 'A')).toBe(A1);
    expect(idOf(byId(t, THIRD), 'A')).toBe(A2);
  });

  it('@TM-033 does not resolve the bracket when a semifinal ended in a draw', () => {
    const [s1, s2] = playedSemis();
    const t = tournamentOf([...finishedGroups(), { ...s1, scoreA: 1, scoreB: 1 }, s2, ...finals()]);
    resolveBracketAfterPlayoffMatch(t);
    expect(byId(t, FINAL)?.slotA?.kind).toBe('pending');
    expect(idOf(byId(t, FINAL), 'B')).toBe(B2);
  });

  it('@TM-033 does not resolve the bracket while the semifinal sides are still open', () => {
    const [s1, s2] = semis();
    const t = tournamentOf([...finishedGroups(), { ...s1, scoreA: 1, scoreB: 0 }, { ...s2, scoreA: 1, scoreB: 0 }, ...finals()]);
    const result = resolveBracketAfterPlayoffMatch(t);
    expect(result?.wasResolved).toBe(false);
  });

  it('@TM-033 Gegenbeispiel: ein unfertiger Gruppenrang wird hier nie aus der Tabelle besetzt', () => {
    // Gruppe B hat noch kein Ergebnis – die Tabelle liefert trotzdem eine Reihenfolge
    const t = tournamentOf([groupMatch(testUuid(301), A1, A2, 'A', [2, 1]), groupMatch(testUuid(302), B1, B2, 'B'), ...semis()]);
    const result = resolveBracketAfterPlayoffMatch(t);
    expect(result?.wasResolved).toBe(false);
    expect(byId(t, SEMI1)?.slotA?.kind).toBe('pending');
  });

  it('@TM-033 Gegenbeispiel: ein Verweis auf eine Bezeichnung statt der Spiel-ID findet kein Vorgängerspiel', () => {
    // Spiel mit der ID 'semi1' existiert; der Slot zeigt aber auf die UUID des echten Halbfinals.
    const [s1, s2] = playedSemis();
    const decoy: Match = { ...s1, id: 'semi1', ...vs(B1, B2), scoreA: 9, scoreB: 0 };
    const t = tournamentOf([...finishedGroups(), decoy, s1, s2, ...finals()]);
    resolveBracketAfterPlayoffMatch(t);
    expect(idOf(byId(t, FINAL), 'A')).toBe(A1);
  });
});
