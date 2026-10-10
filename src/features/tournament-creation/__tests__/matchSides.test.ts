import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../../types/tournament';
import { sideLabel, replaceSides } from '../utils/matchSides';
import { vs } from '../../../test/matchSlotFixtures';
import { testUuid } from '../../../test/testIds';

const teams: Team[] = [
  { id: testUuid(1), name: 'A' },
  { id: testUuid(2), name: 'B' },
];
const match: Match = {
  id: 'm1',
  round: 1,
  field: 1,
  ...vs(testUuid(1), testUuid(2)),
};

describe('matchSides – Ein-Stellen-Regel Wizard', () => {
  it('sideLabel liest die Seiten über den Adapter', () => {
    expect(sideLabel(match, 'A', teams)).toBe('A');
    expect(sideLabel(match, 'B', teams)).toBe('B');
  });

  it('sideLabel zeigt unbekannte Teams als ID', () => {
    const unknown: Match = { ...match, teamA: 'x' };
    expect(sideLabel(unknown, 'A', teams)).toBe('x');
  });

  it('replaceSides ersetzt nur die betroffene Seite', () => {
    const replaced = replaceSides(match, testUuid(1), testUuid(9));
    expect(replaced.teamA).toBe(testUuid(9));
    expect(replaced.teamB).toBe(testUuid(2));
  });
});
