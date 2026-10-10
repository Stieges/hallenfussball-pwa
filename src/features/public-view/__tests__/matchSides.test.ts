/**
 * Tests der Seiten-Adapter der Zuschauer-Seite (Ein-Stellen-Regel § 2 Nr. 9).
 */
import { describe, it, expect } from 'vitest';
import { involvesTeam, sideLabel } from '../matchSides';
import { createMockTeam } from '../../../test/factories';

describe('involvesTeam', () => {
  const match = { originalTeamA: 'team-nord', originalTeamB: 'team-sued' };

  it('erkennt beide Seiten', () => {
    expect(involvesTeam(match, 'team-nord')).toBe(true);
    expect(involvesTeam(match, 'team-sued')).toBe(true);
  });

  it('Gegenbeispiel: fremdes Team und Platzhalter sind nicht beteiligt', () => {
    expect(involvesTeam(match, 'team-west')).toBe(false);
    expect(involvesTeam({ originalTeamA: 'group-a-1st', originalTeamB: 'group-b-2nd' }, 'team-nord')).toBe(false);
  });
});

describe('sideLabel', () => {
  const teams = [createMockTeam({ id: 'team-nord', name: 'FC Nord' }), createMockTeam({ id: 'team-sued', name: 'SV Süd' })];
  const match = { teamA: 'team-nord', teamB: 'team-sued' };

  it('liefert den Teamnamen je Seite', () => {
    expect(sideLabel(match, 'A', teams)).toBe('FC Nord');
    expect(sideLabel(match, 'B', teams)).toBe('SV Süd');
  });

  it('unbekannte ID (Platzhalter) wird wörtlich zurückgegeben', () => {
    expect(sideLabel({ teamA: 'winner-semi-1', teamB: 'team-sued' }, 'A', teams)).toBe('winner-semi-1');
  });
});
