/**
 * Tests der Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9).
 */
import { describe, it, expect } from 'vitest';
import { involvesTeam, sideLabel } from '../matchSides';
import { createMockTeam } from '../../../test/factories';
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

describe('sideLabel', () => {
  const teams = [createMockTeam({ id: testUuid(1), name: 'FC Nord' }), createMockTeam({ id: testUuid(2), name: 'SV Süd' })];
  const match = vs(testUuid(1), testUuid(2));

  it('liefert den Teamnamen je Seite', () => {
    expect(sideLabel(match, 'A', teams)).toBe('FC Nord');
    expect(sideLabel(match, 'B', teams)).toBe('SV Süd');
  });

  it('unbekannte Team-ID wird wörtlich zurückgegeben', () => {
    expect(sideLabel(vs(testUuid(9), testUuid(2)), 'A', teams)).toBe(testUuid(9));
  });

  it('liest nur Slots: ein Köder in teamA/teamB wird ignoriert', () => {
    const decoy = { ...match, teamA: 'KOEDER', teamB: 'KOEDER' };
    expect(sideLabel(decoy, 'A', teams)).toBe('FC Nord');
  });
});
