/** B-16d1 – Gegenbeispiele zu matchSides (Spec § 2 Nr. 9): Namenssuche, Rohwert-Rückfall, Seite B. */
import { describe, it, expect } from 'vitest';
import type { Match } from '../../../types/tournament';
import { sideLabel, sideTeam } from '../matchSides';
import { FIXTURE_MATCHES, FIXTURE_TEAMS } from './monitorFixture';

const spiel: Match = { ...FIXTURE_MATCHES[0], teamA: 'team-nord', teamB: 'SV Süd' };

describe('matchSides (B-16d1)', () => {
  it('Team wird per ID oder per Name gefunden', () => {
    expect(sideLabel(spiel, 'A', FIXTURE_TEAMS)).toBe('FC Nord');
    expect(sideLabel(spiel, 'B', FIXTURE_TEAMS)).toBe('SV Süd');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).toBe('team-sued');
  });

  it('unbekannte ID wird als Text angezeigt, kein Team', () => {
    const unbekannt: Match = { ...spiel, teamA: 'team-weg' };
    expect(sideLabel(unbekannt, 'A', FIXTURE_TEAMS)).toBe('team-weg');
    expect(sideTeam(unbekannt, 'A', FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Seite B liefert nie Team A', () => {
    expect(sideLabel(spiel, 'B', FIXTURE_TEAMS)).not.toBe('FC Nord');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).not.toBe('team-nord');
  });
});
