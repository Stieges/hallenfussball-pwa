/**
 * Tests der Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9).
 */
import { describe, it, expect } from 'vitest';
import { involvesTeam } from '../matchSides';
import { vs, groupRank, slots } from '../../../test/matchSlotFixtures';
import { testUuid } from '../../../test/testIds';

describe('involvesTeam', () => {
  const match = vs(testUuid(1), testUuid(2));

  it('erkennt beide Seiten', () => {
    expect(involvesTeam(match, testUuid(1))).toBe(true);
    expect(involvesTeam(match, testUuid(2))).toBe(true);
  });

  it('Gegenbeispiel: fremdes Team und Platzhalter sind nicht beteiligt', () => {
    expect(involvesTeam(match, testUuid(3))).toBe(false);
    expect(involvesTeam(slots(groupRank('A', 1), groupRank('B', 2)), testUuid(1))).toBe(false);
  });
});
