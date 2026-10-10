/**
 * B-16d1 – Gegenbeispiele zu matchSides (Spec § 2 Nr. 9): Namenssuche, Rohwert-Rückfall, Seite B.
 * B-16f2 – Herkunft offener Plätze an einer Stelle: Platzhalter lesbar, Kindermodus „noch offen“.
 */
import { describe, it, expect } from 'vitest';
import type { Match } from '../../../types/tournament';
import { sideLabel, sideTeam } from '../matchSides';
import { FIXTURE_MATCHES, FIXTURE_TEAMS } from './monitorFixture';

const spiel: Match = { ...FIXTURE_MATCHES[0], teamA: 'team-nord', teamB: 'SV Süd' };
const ctx = { teams: FIXTURE_TEAMS };

describe('matchSides (B-16d1)', () => {
  it('Team wird per ID oder per Name gefunden', () => {
    expect(sideLabel(spiel, 'A', ctx)).toBe('FC Nord');
    expect(sideLabel(spiel, 'B', ctx)).toBe('SV Süd');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).toBe('team-sued');
  });

  it('unbekannte ID wird als Text angezeigt, kein Team', () => {
    const unbekannt: Match = { ...spiel, teamA: 'team-weg' };
    expect(sideLabel(unbekannt, 'A', ctx)).toBe('team-weg');
    expect(sideTeam(unbekannt, 'A', FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Seite B liefert nie Team A', () => {
    expect(sideLabel(spiel, 'B', ctx)).not.toBe('FC Nord');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).not.toBe('team-nord');
  });
});

describe('matchSides – Herkunft offener Plätze (B-16f2)', () => {
  const offen: Match = { ...spiel, teamA: 'group-a-1st', teamB: 'group-b-2nd' };

  it('ohne Kindermodus: Platzhalter lesbar („1. Gruppe A“)', () => {
    expect(sideLabel(offen, 'A', ctx)).toBe('1. Gruppe A');
    expect(sideLabel(offen, 'B', ctx)).toBe('2. Gruppe B');
  });

  it('Sieger eines Halbfinals lesbar („Sieger 1. Halbfinale“)', () => {
    expect(sideLabel({ ...spiel, teamA: 'semi1-winner' }, 'A', ctx)).toBe('Sieger 1. Halbfinale');
  });

  it('Kindermodus: offener Platz zeigt tournament:slot.undecided, nie den Platzhalter', () => {
    const kinder = { teams: FIXTURE_TEAMS, hidePendingOrigin: true };
    expect(sideLabel(offen, 'A', kinder)).toBe('tournament:slot.undecided');
    expect(sideLabel(offen, 'A', kinder)).not.toContain('Gruppe');
  });

  it('Kindermodus ändert nichts an einem Team', () => {
    expect(sideLabel(spiel, 'A', { teams: FIXTURE_TEAMS, hidePendingOrigin: true })).toBe('FC Nord');
  });

  it('unbekannte ID ohne Kindermodus bleibt Text (Bestand)', () => {
    expect(sideLabel({ ...spiel, teamA: 'team-weg' }, 'A', ctx)).toBe('team-weg');
  });
});
