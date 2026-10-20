/**
 * A-12a Nachweis am Bestand (Plan GA4 v1 § Lücken: „@TM-007/@TM-008 nur Nachweis, Abweichung → Befund“), Record
 * Turniermodi (2026-10-01):
 *  - @TM-007 Spielreihenfolge innerhalb einer Gruppe nach dem DFB-Schlüssel,
 *  - @TM-008 Ohne DFB-Schlüssel gilt die Kreismethode (Zeile „heute prüfbar“: 6 Teams, Kreismethode gewählt).
 * Weg: `generateFullSchedule` (eine Gruppe, ein Feld, Jeder gegen jeden), Team n = n-tes Team der Liste.
 *
 * Der DFB-Schlüssel ist im MVP abgeschaltet (@W4-028, `scheduleGenerator.ts` setzt `dfbPatternCode` nie), weil die
 * Schlüssel-Tabellen lückenhaft sind (Befund C-DFB-SCHLUESSEL-LUECKEN). Zeilen von @TM-007, deren Reihenfolge der
 * Generator deshalb nicht einhält, sind „erwartet rot“ mit diesem Befund.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '..';
import { createMockTeams, createMockTournament } from '../../../test/factories';
import { getDFBPattern, parseDFBMatches } from '../../../constants/dfbMatchPatterns';

/** Paarungen der Gruppenspiele in Spielplan-Reihenfolge als „a-b“ (Teamnummern, kleinere zuerst). */
function groupOrder(teamCount: number, options: { useDFBKeys: boolean; pattern?: string }): string[] {
  const teams = createMockTeams(teamCount, 1);
  const numberOf = new Map(teams.map((team, index) => [team.name, index + 1]));
  const schedule = generateFullSchedule(createMockTournament({
    teams, numberOfTeams: teamCount, numberOfGroups: 1, numberOfFields: 1, groupSystem: 'roundRobin',
    useDFBKeys: options.useDFBKeys, dfbKeyPattern: options.pattern, finalsConfig: { preset: 'none' },
  }));
  return schedule.allMatches
    .filter((m) => m.phase === 'groupStage')
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((m) => [numberOf.get(m.homeTeam) ?? 0, numberOf.get(m.awayTeam) ?? 0].sort((x, y) => x - y).join('-'));
}

/** Reihenfolge des DFB-Schlüssels als „a-b“ (kleinere Nummer zuerst). */
function dfbOrder(teamCount: number): string[] {
  const pattern = getDFBPattern(teamCount);
  if (pattern === undefined) { throw new Error(`kein DFB-Schlüssel für ${teamCount} Teams`); }
  return parseDFBMatches(pattern).map((m) => [m.home, m.away].sort((x, y) => x - y).join('-'));
}

/** Runden der Kreismethode (erstes Team fest, die übrigen rotieren) als Mengen von Paarungen. */
function circleRounds(teamCount: number): string[] {
  const ring: number[] = Array.from({ length: teamCount }, (_, i) => i + 1);
  const rounds: string[] = [];
  for (let round = 0; round < teamCount - 1; round++) {
    const pairs: string[] = [];
    for (let i = 0; i < teamCount / 2; i++) {
      pairs.push([ring[i], ring[teamCount - 1 - i]].sort((x, y) => x - y).join('-'));
    }
    rounds.push(pairs.sort().join(' '));
    ring.splice(1, 0, ring.pop() ?? 0);
  }
  return rounds.sort();
}

describe('@TM-007 Spielreihenfolge innerhalb einer Gruppe nach dem DFB-Schlüssel', () => {
  it('@TM-007 2 Teams (1T02M): das einzige Spiel ist 1–2', () => {
    expect(groupOrder(2, { useDFBKeys: true, pattern: '1T02M' })).toEqual(dfbOrder(2));
  });

  it.fails.each([
    [4, '1T04M'], [6, '1T06M'], [11, '1T11M'], [12, '1T12M'], [18, '1T18M'], [24, '1T24M'],
  ])('@TM-007 C-DFB-SCHLUESSEL-LUECKEN %i Teams (%s): Reihenfolge folgt dem Schlüssel (im MVP abgeschaltet, @W4-028)', (teams, pattern) => {
    expect(groupOrder(teams, { useDFBKeys: true, pattern })).toEqual(dfbOrder(teams));
  });
});

describe('@TM-008 Ohne DFB-Schlüssel gilt die Kreismethode', () => {
  it('@TM-008 6 Teams, Kreismethode gewählt: je drei Spiele bilden eine Runde der Kreismethode, jede Runde genau einmal', () => {
    const order = groupOrder(6, { useDFBKeys: false });
    const rounds = [0, 3, 6, 9, 12].map((start) => order.slice(start, start + 3).sort().join(' '));

    expect(order).toHaveLength(15);
    expect([...rounds].sort()).toEqual(circleRounds(6));
  });
});
