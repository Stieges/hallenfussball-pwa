/**
 * B-16d1 – Gegenbeispiele zu matchSides (Spec § 2 Nr. 9): Seite A/B, unbekanntes Team.
 * B-16f2 – Herkunft offener Plätze an einer Stelle: Herkunft lesbar, Kindermodus „noch offen“.
 *
 * Merge main → Spur B (I1): Die Seiten kommen aus dem Slot. Ein Team wird nur über die ID gefunden
 * (keine Namenssuche mehr, A-03/slotLabel); eine unbekannte ID zeigt `slot.unknown` statt des Rohwerts.
 */
import { describe, it, expect } from 'vitest';
import type { Match } from '../../../types/tournament';
import { sideLabel, sideTeam } from '../matchSides';
import { FIXTURE_MATCHES, FIXTURE_TEAMS } from './monitorFixture';
import { groupRank, looseVs, resultOf, slots, testUuid } from '../../../test/matchSlotFixtures';

const spiel: Match = { ...FIXTURE_MATCHES[0], ...looseVs('team-nord', 'team-sued') };
const ctx = { teams: FIXTURE_TEAMS };

describe('matchSides (B-16d1)', () => {
  it('Team wird über die ID im Slot gefunden', () => {
    expect(sideLabel(spiel, 'A', ctx)).toBe('FC Nord');
    expect(sideLabel(spiel, 'B', ctx)).toBe('SV Süd');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).toBe('team-sued');
  });

  it('unbekannte ID: kein Team, Anzeige slot.unknown (nie der Rohwert)', () => {
    const unbekannt: Match = { ...spiel, ...looseVs('team-weg', 'team-sued') };
    expect(sideTeam(unbekannt, 'A', FIXTURE_TEAMS)).toBeUndefined();
    expect(sideLabel(unbekannt, 'A', ctx)).toBe('tournament:slot.unknown');
    expect(sideLabel(unbekannt, 'A', ctx)).not.toBe('team-weg');
  });

  it('Gegenbeispiel: ein Teamname im Slot findet kein Team (keine Namenssuche)', () => {
    const perName: Match = { ...spiel, ...looseVs('FC Nord', 'team-sued') };
    expect(sideTeam(perName, 'A', FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Seite B liefert nie Team A', () => {
    expect(sideLabel(spiel, 'B', ctx)).not.toBe('FC Nord');
    expect(sideTeam(spiel, 'B', FIXTURE_TEAMS)?.id).not.toBe('team-nord');
  });
});

describe('matchSides – Herkunft offener Plätze (B-16f2, @TM-015)', () => {
  const offen: Match = { ...spiel, ...slots(groupRank('A', 1), groupRank('B', 2)) };

  it('ohne Kindermodus: Herkunft über den Schlüssel slot.groupRank', () => {
    expect(sideLabel(offen, 'A', ctx)).toBe('tournament:slot.groupRank');
    expect(sideTeam(offen, 'A', FIXTURE_TEAMS)).toBeUndefined();
  });

  it('Sieger eines Spiels braucht die Spiele im Kontext (sonst slot.unknown)', () => {
    const hf1: Match = { ...spiel, id: testUuid(901), label: '1. Halbfinale' };
    const finale: Match = { ...spiel, ...slots(resultOf(hf1.id, 'winner'), resultOf(hf1.id, 'loser')) };
    expect(sideLabel(finale, 'A', { ...ctx, matches: [hf1] })).toBe('tournament:slot.winnerOf');
    expect(sideLabel(finale, 'A', ctx)).toBe('tournament:slot.unknown');
  });

  it('Kindermodus: offener Platz zeigt tournament:slot.undecided, nie die Herkunft', () => {
    const kinder = { teams: FIXTURE_TEAMS, hidePendingOrigin: true };
    expect(sideLabel(offen, 'A', kinder)).toBe('tournament:slot.undecided');
    expect(sideLabel(offen, 'A', kinder)).not.toBe('tournament:slot.groupRank');
  });

  it('Kindermodus ändert nichts an einem Team', () => {
    expect(sideLabel(spiel, 'A', { teams: FIXTURE_TEAMS, hidePendingOrigin: true })).toBe('FC Nord');
  });
});
