/**
 * A-04a (K6) – manueller Tausch/Umbesetzen durch die Leitung verwirft `resolvedFrom`.
 * @TM-027 (alle Geräte zeigen dieselbe Besetzung: der Tausch muss in die Cloud).
 */
import { describe, it, expect } from 'vitest';
import type { Match } from '../../../types/tournament';
import { assignTeamToSide, swapTeamsBetweenMatches } from '../matchAssignment';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';

const NORD = testUuid(1);
const SUED = testUuid(2);
const UFER = testUuid(3);
const source = { kind: 'groupRank', group: 'A', rank: 1 } as const;

const resolved = {
  id: testUuid(100), round: 1, field: 1, teamA: NORD, teamB: SUED,
  slotA: teamSlot(NORD, source), slotB: teamSlot(SUED),
} as Match;

describe('assignTeamToSide (K6)', () => {
  it('@TM-027 Umbesetzen verwirft resolvedFrom: die Seite ist direkt besetzt', () => {
    const changed = assignTeamToSide(resolved, 'A', UFER);
    expect(changed.slotA).toEqual(teamSlot(UFER));
    expect(changed.slotA).not.toHaveProperty('resolvedFrom');
    expect(changed.teamA).toBe(UFER);
  });

  it('@TM-027 Gegenbeispiel: die andere Seite bleibt unverändert, auch ihre Herkunft', () => {
    const withSourceB = { ...resolved, slotB: teamSlot(SUED, source) } as Match;
    const changed = assignTeamToSide(withSourceB, 'A', UFER);
    expect(changed.slotB).toEqual(teamSlot(SUED, source));
    expect(changed.teamB).toBe(resolved.teamB);
  });

  it('Ein Teamname statt einer Team-ID wird abgelehnt', () => {
    expect(() => assignTeamToSide(resolved, 'A', 'FC Ufer')).toThrow();
  });
});

describe('swapTeamsBetweenMatches (K6)', () => {
  const other = {
    id: testUuid(101), round: 2, field: 1, teamA: UFER, teamB: NORD,
    slotA: teamSlot(UFER, source), slotB: teamSlot(NORD),
  } as Match;

  it('@TM-027 Tausch: beide Seiten tauschen das Team und tragen keine Herkunft mehr', () => {
    const [first, second] = swapTeamsBetweenMatches({ match: resolved, side: 'A' }, { match: other, side: 'A' });
    expect(first.slotA).toEqual(teamSlot(UFER));
    expect(second.slotA).toEqual(teamSlot(NORD));
    expect(first.slotA).not.toHaveProperty('resolvedFrom');
    expect(second.slotA).not.toHaveProperty('resolvedFrom');
  });

  it('Gegenbeispiel: eine offene Seite lässt sich nicht tauschen', () => {
    const pending = { ...other, slotA: pendingSlot(source) } as Match;
    expect(() => swapTeamsBetweenMatches({ match: resolved, side: 'A' }, { match: pending, side: 'A' })).toThrow(/besetzte Seiten/);
  });
});
