/**
 * @W4-028 – DFB-Schlüssel wird nicht angeboten, solange er nicht exakt umgesetzt ist.
 *
 * Dann ein Turnier, das noch einen DFB-Schlüssel gespeichert hat, bekommt beim Erzeugen
 * einen vollständigen Spielplan, in dem jede Paarung genau einmal vorkommt.
 * Der Weg läuft über generateFullSchedule (scheduleGenerator.ts) – dort wird
 * `dfbPatternCode` für das Turnier bestimmt.
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '..';
import type { Tournament } from '../../../types/tournament';
import { createMockTournament, createMockTeams } from '../../../test/factories';

const tournamentOf = (teamCount: number, pattern: string): Tournament =>
  createMockTournament({
    teams: createMockTeams(teamCount, 1),
    numberOfTeams: teamCount,
    numberOfGroups: 1,
    numberOfFields: 1,
    groupSystem: 'roundRobin',
    useDFBKeys: true,
    dfbKeyPattern: pattern,
    finalsConfig: { preset: 'none' },
  });

/** Gruppenspiele als ungeordnete Paar-Schlüssel (Teamnamen sind je Turnier eindeutig). */
const groupPairs = (teamCount: number, pattern: string): string[] => {
  const schedule = generateFullSchedule(tournamentOf(teamCount, pattern));
  return schedule.allMatches
    .filter((m) => m.phase === 'groupStage')
    .map((m) => [m.homeTeam, m.awayTeam].sort().join(' | '));
};

/** Alle Paarungen einer Gruppe mit n Teams, jeweils einmal. */
const allPairs = (n: number): string[] => {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      out.push([`Team ${i}`, `Team ${j}`].sort().join(' | '));
    }
  }
  return out;
};

describe('@W4-028 Spielplan mit gespeichertem DFB-Schlüssel', () => {
  it('@W4-028 6 Teams auf 1 Feld mit 1T06M: 15 Gruppenspiele, jede Paarung genau einmal', () => {
    const pairs = groupPairs(6, '1T06M');

    expect(pairs).toHaveLength(15);
    expect(new Set(pairs).size).toBe(15);
    expect([...pairs].sort()).toEqual(allPairs(6).sort());
  });

  it('@W4-028 Gegenbeispiel: ohne DFB-Schlüssel (useDFBKeys=false) bleibt der Plan für 6 Teams vollständig: 15 Spiele, jede Paarung einmal', () => {
    const schedule = generateFullSchedule({ ...tournamentOf(6, '1T06M'), useDFBKeys: false });
    const pairs = schedule.allMatches
      .filter((m) => m.phase === 'groupStage')
      .map((m) => [m.homeTeam, m.awayTeam].sort().join(' | '));

    expect(pairs).toHaveLength(15);
    expect(new Set(pairs).size).toBe(15);
    expect([...pairs].sort()).toEqual(allPairs(6).sort());
  });

  it('@W4-028 7 Teams auf 1 Feld mit 1T07M (gespeicherter Schlüssel): 21 Gruppenspiele, jede Paarung genau einmal', () => {
    const pairs = groupPairs(7, '1T07M');

    expect(pairs).toHaveLength(21);
    expect(new Set(pairs).size).toBe(21);
    expect([...pairs].sort()).toEqual(allPairs(7).sort());
  });
});
