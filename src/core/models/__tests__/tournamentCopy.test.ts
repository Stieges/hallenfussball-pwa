/**
 * A-04a – „Turnier kopieren“ (V14): Slots dürfen nicht auf alte Team-/Spiel-IDs stehen bleiben.
 * @TM-015 (offene Seiten behalten ihre Herkunft, auch in der Kopie).
 */
import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../../types/tournament';
import { copyTeamsAndMatches } from '../tournamentCopy';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';

const T1 = testUuid(1);
const T2 = testUuid(2);
const M_GROUP = testUuid(101);
const M_SEMI = testUuid(102);
const M_FINAL = testUuid(103);

const teams = [
  { id: T1, name: 'FC Nord' },
  { id: T2, name: 'VfB Ufer' },
] as Team[];

const groupRank = { kind: 'groupRank', group: 'A', rank: 1 } as const;
const matches = [
  { id: M_GROUP, round: 1, field: 1, teamA: T1, teamB: T2, slotA: teamSlot(T1), slotB: teamSlot(T2), scoreA: 3, scoreB: 1, matchStatus: 'finished' },
  // Seite wurde aus Gruppe A Rang 1 aufgelöst
  { id: M_SEMI, round: 2, field: 1, teamA: T1, teamB: 'TBD', slotA: teamSlot(T1, groupRank), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }) },
  { id: M_FINAL, round: 3, field: 1, teamA: 'TBD', teamB: 'TBD', slotA: pendingSlot({ kind: 'matchResult', matchId: M_SEMI, role: 'winner' }), slotB: pendingSlot({ kind: 'matchResult', matchId: M_GROUP, role: 'loser' }) },
] as Match[];

let counter = 1000;
const makeId = () => testUuid(counter++);

describe('copyTeamsAndMatches (V14)', () => {
  const copy = copyTeamsAndMatches({ teams, matches }, makeId);
  const [gruppe, semi, finale] = copy.matches;
  const [newT1, newT2] = copy.teams;

  it('@TM-015 besetzte Seite zeigt auf die NEUE Team-ID, Namen bleiben', () => {
    expect(newT1.id).not.toBe(T1);
    expect(gruppe.slotA).toEqual(teamSlot(newT1.id));
    expect(gruppe.slotB).toEqual(teamSlot(newT2.id));
    expect(newT1.name).toBe('FC Nord');
  });

  it('@TM-015 aufgelöste Seite wird in der Kopie wieder offen und behält ihre Herkunft', () => {
    expect(semi.slotA).toEqual(pendingSlot(groupRank));
    expect(semi.slotB).toEqual(pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }));
  });

  it('@TM-015 Verweis auf ein Vorgängerspiel zeigt auf die NEUE Spiel-ID', () => {
    expect(finale.slotA).toEqual(pendingSlot({ kind: 'matchResult', matchId: semi.id, role: 'winner' }));
    expect(finale.slotB).toEqual(pendingSlot({ kind: 'matchResult', matchId: gruppe.id, role: 'loser' }));
  });

  it('@TM-015 Gegenbeispiel: nirgends bleibt eine alte Team- oder Spiel-ID stehen', () => {
    const json = JSON.stringify(copy);
    for (const alt of [T1, T2, M_GROUP, M_SEMI, M_FINAL]) {
      expect(json).not.toContain(alt);
    }
  });

  it('Kopie hat keine Ergebnisse; das Übergangsfeld folgt dem Slot', () => {
    expect(gruppe).toMatchObject({ matchStatus: 'scheduled', scoreA: 0, scoreB: 0, events: [], teamA: newT1.id, teamB: newT2.id });
    expect(semi).toMatchObject({ teamA: 'TBD', teamB: 'TBD' });
  });

  it('Gegenbeispiel: ein Spiel ohne Slots lehnt die Kopie ab statt Seiten zu raten', () => {
    const altdaten = [{ id: M_GROUP, round: 1, field: 1, teamA: T1, teamB: T2 }] as Match[];
    expect(() => copyTeamsAndMatches({ teams, matches: altdaten }, makeId)).toThrow(/keine Spielseiten/);
  });
});
