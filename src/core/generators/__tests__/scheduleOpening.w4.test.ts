/**
 * Eröffnung durch Mannschaften des Veranstalters – Generator-Teil, Tests aus dem Gherkin des Records
 * docs/anforderungen/2026-09-27_wizard-zeitrahmen-fairness.md:
 * @W4-027, @W4-033 (Generator-Teil), @W4-041 (Generator ignoriert die Wahl), @W4-042, @W4-043, @W4-044 (Generator-Teil).
 */
import { describe, expect, it } from 'vitest';
import type { Match } from '../../../types/tournament';
import { generateGroupPhaseSchedule, generateGroupPhaseScheduleWithReport, type GroupPhaseScheduleOptions } from '../fairScheduler';
import {
  awayOf,
  consecutiveSlotDoubles,
  homeAwayStats,
  homeOf,
  longestPauseGames,
  longestPauseMinutes,
  longestSlotsBetween,
  matchNumberOf,
  minGamesBetween,
  ordered,
  playedTimeline,
  scenarioOptions,
  signature,
  slotCount,
  teamIdsOf,
} from './roundsScenarioHelpers';

/** Die ersten beiden Teams der ersten Gruppe heißen im Szenario „TSV Waging rot“ und „TSV Waging blau“. */
function waging(options: GroupPhaseScheduleOptions, group = 0): { rot: string; blau: string } {
  const teams = [...options.groups.values()][group];
  return { rot: teams[0].id, blau: teams[1].id };
}

function firstMatch(matches: Match[]): Match {
  return ordered(matches)[0];
}

/** Fairness-Kennzahlen, die durch die Eröffnung nicht schlechter werden dürfen. */
function fairness(matches: Match[], ids: string[]): Record<string, number> {
  const stats = [...homeAwayStats(matches).values()];
  return {
    longestPause: longestPauseGames(matches),
    shortestPause: minGamesBetween(matches),
    maxDiff: playedTimeline(matches, ids).maxDiff,
    equalPoints: playedTimeline(matches, ids).equalAfter.length,
    longestStreak: Math.max(...stats.map((s) => s.longestStreak)),
    maxHome: Math.max(...stats.map((s) => s.home)),
    minHome: Math.min(...stats.map((s) => s.home)),
  };
}

describe('@W4-027 Eine Mannschaft des Veranstalters bestreitet das erste Spiel als Heimmannschaft', () => {
  it.each([
    { aufbau: '6 Teams auf einem Feld', sizes: [6], fields: 1 },
    { aufbau: '4 Teams auf einem Feld', sizes: [4], fields: 1 },
    { aufbau: '6 Teams auf 2 Feldern', sizes: [6], fields: 2 },
    { aufbau: '2 Gruppen zu je 6 Teams auf einem Feld', sizes: [6, 6], fields: 1 },
  ])('$aufbau: rot und blau markiert → eine von beiden ist in Spiel 1 Heimmannschaft', ({ sizes, fields }) => {
    const base = scenarioOptions(sizes, fields);
    const { rot, blau } = waging(base);
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau] });

    expect([rot, blau]).toContain(homeOf(firstMatch(matches)));
  });

  it('ohne markierte Mannschaft ist der Plan derselbe wie mit leerer Liste', () => {
    const base = scenarioOptions([6], 1);

    expect(signature(generateGroupPhaseSchedule({ ...base, hostTeamIds: [] })))
      .toBe(signature(generateGroupPhaseSchedule(base)));
  });
});

describe('@W4-033 Bei zwei Mannschaften des Veranstalters wählt die Turnierleitung das Eröffnungsspiel', () => {
  const base = scenarioOptions([6], 1);
  const { rot, blau } = waging(base);
  const ids = teamIdsOf(base);
  const ohneMarkierung = fairness(generateGroupPhaseSchedule(base), ids);

  it('„Vereinsduell eröffnet“: Spiel 1 ist rot gegen blau', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau], openingMode: 'club-derby' });

    expect([homeOf(firstMatch(matches)), awayOf(firstMatch(matches))]).toEqual([rot, blau]);
    expect(fairness(matches, ids)).toEqual(ohneMarkierung);
  });

  it('„Veranstalter gegen einen Gast“: Waging als Heim gegen einen Gast, Vereinsduell in Spiel 4 bis 6', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau], openingMode: 'guest-opening' });

    expect([rot, blau]).toContain(homeOf(firstMatch(matches)));
    expect([rot, blau]).not.toContain(awayOf(firstMatch(matches)));
    expect(matchNumberOf(matches, rot, blau)).toBeGreaterThanOrEqual(4);
    expect(matchNumberOf(matches, rot, blau)).toBeLessThanOrEqual(6);
    expect(fairness(matches, ids)).toEqual(ohneMarkierung);
  });

  it('ohne eigene Wahl gilt „Veranstalter gegen einen Gast, Vereinsduell in Runde 2“', () => {
    const ohneWahl = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau] });
    const gastEroeffnung = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau], openingMode: 'guest-opening' });

    expect(signature(ohneWahl)).toBe(signature(gastEroeffnung));
  });

  it.each([5, 7, 8, 9, 10])('Eigenschaft %i Teams: beide Wahlen wirken, Fairness wie ohne Markierung', (n) => {
    const options = scenarioOptions([n], 1);
    const pair = waging(options);
    const allIds = teamIdsOf(options);
    const reference = fairness(generateGroupPhaseSchedule(options), allIds);
    const perRound = Math.floor(n / 2);

    const derby = generateGroupPhaseSchedule({ ...options, hostTeamIds: [pair.rot, pair.blau], openingMode: 'club-derby' });
    expect(matchNumberOf(derby, pair.rot, pair.blau)).toBe(1);
    expect(homeOf(firstMatch(derby))).toBe(pair.rot);
    expect(fairness(derby, allIds)).toEqual(reference);

    const guest = generateGroupPhaseSchedule({ ...options, hostTeamIds: [pair.rot, pair.blau], openingMode: 'guest-opening' });
    expect([pair.rot, pair.blau]).toContain(homeOf(firstMatch(guest)));
    expect(matchNumberOf(guest, pair.rot, pair.blau)).toBeGreaterThan(perRound);
    expect(matchNumberOf(guest, pair.rot, pair.blau)).toBeLessThanOrEqual(2 * perRound);
    expect(fairness(guest, allIds)).toEqual(reference);
  });

  it('stehen beide in verschiedenen Gruppen, entfällt die Wahl und eine von ihnen eröffnet als Heim', () => {
    const groups = scenarioOptions([6, 6], 1);
    const rotA = waging(groups, 0).rot;
    const blauB = waging(groups, 1).rot;
    const allIds = teamIdsOf(groups);
    const reference = fairness(generateGroupPhaseSchedule(groups), allIds);

    for (const openingMode of ['club-derby', 'guest-opening'] as const) {
      const matches = generateGroupPhaseSchedule({ ...groups, hostTeamIds: [rotA, blauB], openingMode });
      expect([rotA, blauB]).toContain(homeOf(firstMatch(matches)));
      expect(fairness(matches, allIds)).toEqual(reference);
    }
  });
});

describe('@W4-041 Wo kein Rundenplan entsteht, wirkt die Wahl des Eröffnungsspiels nicht (Generator-Teil)', () => {
  it('6 Teams auf 2 Feldern: beide Wahlen ergeben denselben Plan, eine Waging-Mannschaft eröffnet als Heim', () => {
    const base = scenarioOptions([6], 2);
    const { rot, blau } = waging(base);
    const derby = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau], openingMode: 'club-derby' });
    const guest = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot, blau], openingMode: 'guest-opening' });

    expect(signature(derby)).toBe(signature(guest));
    expect([rot, blau]).toContain(homeOf(firstMatch(derby)));
  });
});

describe('@W4-042 Bei mehreren Feldern eröffnet die Mannschaft des Veranstalters auf Feld 1', () => {
  it('6 Teams auf 2 Feldern: rot spielt in Spiel 1 auf Feld 1 im ersten Zeitfenster als Heim', () => {
    const base = scenarioOptions([6], 2);
    const { rot } = waging(base);
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot] });
    const first = firstMatch(mit);

    expect(first.field).toBe(1);
    expect(first.slot).toBe(0);
    expect(homeOf(first)).toBe(rot);
    expect(slotCount(mit)).toBe(slotCount(ohne));
    expect(longestPauseMinutes(mit)).toBe(longestPauseMinutes(ohne));
  });

  it.each([1, 2, 3, 4, 5])('Eigenschaft: auch Team %i als einzige Markierung eröffnet auf Feld 1', (index) => {
    const base = scenarioOptions([6], 2);
    const host = teamIdsOf(base)[index];
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] });

    expect(homeOf(firstMatch(mit))).toBe(host);
    expect(firstMatch(mit).field).toBe(1);
    expect(slotCount(mit)).toBe(slotCount(ohne));
    expect(longestPauseMinutes(mit)).toBe(longestPauseMinutes(ohne));
  });
});

describe('@W4-043 Steht die Mannschaft des Veranstalters in Gruppe B, eröffnet trotzdem sie', () => {
  it.each([0, 2, 4])('2 Gruppen zu je 5 Teams, rot = Team %i aus Gruppe B → Spiel 1 als Heim, nicht unfairer', (index) => {
    const base = scenarioOptions([5, 5], 1);
    const rot = [...base.groups.values()][1][index].id;
    const ids = teamIdsOf(base);
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [rot] });

    expect(homeOf(firstMatch(mit))).toBe(rot);
    expect(longestPauseGames(mit)).toBeLessThanOrEqual(longestPauseGames(ohne));
    expect(playedTimeline(mit, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
  });
});

describe('@W4-027/@W4-043 Ungleich große Gruppen: jede Mannschaft des Veranstalters eröffnet (Fixrunde 1, A1)', () => {
  const setups = [
    { aufbau: '6+5 auf einem Feld', sizes: [6, 5], fields: 1 },
    { aufbau: '6+5 auf 2 Feldern', sizes: [6, 5], fields: 2 },
    { aufbau: '8+7 auf einem Feld', sizes: [8, 7], fields: 1 },
  ];
  const cases = setups.flatMap((setup) => {
    const ids = teamIdsOf(scenarioOptions(setup.sizes, setup.fields));
    return ids.map((_, index) => ({ ...setup, index }));
  });

  it.each(cases)('$aufbau, markiert Team $index: Spiel 1 als Heim, längste Pause und Unterschied nicht größer, Mindestpause gehalten', ({ sizes, fields, index }) => {
    const base = scenarioOptions(sizes, fields);
    const ids = teamIdsOf(base);
    const host = ids[index];
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] });

    expect(homeOf(firstMatch(mit))).toBe(host);
    expect(longestPauseMinutes(mit)).toBeLessThanOrEqual(longestPauseMinutes(ohne));
    expect(playedTimeline(mit, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
    expect(slotCount(mit)).toBeLessThanOrEqual(slotCount(ohne));
    expect(consecutiveSlotDoubles(mit)).toBe(0); // Mindestpause 1 Zeitfenster
  });
});

describe('@W4-045 Geht die Eröffnung durch den Veranstalter nur mit längerer Pause, eröffnet er trotzdem und die App sagt es', () => {
  const base = scenarioOptions([4, 3], 1);
  const ids = teamIdsOf(base);
  const ohne = generateGroupPhaseScheduleWithReport(base).matches;

  it.each(ids.map((_, index) => ({ index })))('4+3 auf einem Feld, markiert Team $index: eröffnet als Heim, Meldung nennt die längere Pause', ({ index }) => {
    const host = ids[index];
    const result = generateGroupPhaseScheduleWithReport({ ...base, hostTeamIds: [host] });
    const costs = result.notices.filter((n) => n.kind === 'hostOpeningCostsPause');

    expect(homeOf(firstMatch(result.matches))).toBe(host);
    expect(result.notices.filter((n) => n.kind === 'hostOpeningNotPossible')).toEqual([]);
    expect(consecutiveSlotDoubles(result.matches)).toBe(0); // harte Mindestpause bleibt
    if (longestSlotsBetween(result.matches) > longestSlotsBetween(ohne)) {
      expect(costs).toEqual([{
        kind: 'hostOpeningCostsPause',
        teamId: host,
        longestPauseBefore: longestSlotsBetween(ohne),
        longestPauseAfter: longestSlotsBetween(result.matches),
      }]);
    } else {
      expect(costs).toEqual([]);
    }
  });

  it('Vorbedingung: mindestens eine Markierung verlängert die längste Pause (sonst prüft der Test nichts)', () => {
    const longer = ids.filter((host) => longestSlotsBetween(generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] })) > longestSlotsBetween(ohne));

    expect(longer.length).toBeGreaterThan(0);
  });
});

describe('@W4-044 Eine gelöschte oder abgewählte Mannschaft des Veranstalters hinterlässt keine Regel (Generator-Teil)', () => {
  it('blau gelöscht: die verwaiste Markierung wird ignoriert, es gilt nur rot', () => {
    const base = scenarioOptions([7], 1);
    const { rot, blau } = waging(base);
    const ohneBlau = new Map([...base.groups].map(([key, teams]) => [key, teams.filter((t) => t.id !== blau)]));
    const options = { ...base, groups: ohneBlau };

    const verwaist = generateGroupPhaseSchedule({ ...options, hostTeamIds: [rot, blau], openingMode: 'club-derby' });
    const nurRot = generateGroupPhaseSchedule({ ...options, hostTeamIds: [rot] });

    expect(signature(verwaist)).toBe(signature(nurRot));
    expect(homeOf(firstMatch(verwaist))).toBe(rot);
  });

  it('auch rot abgewählt: derselbe Plan wie ohne Markierung', () => {
    const base = scenarioOptions([6], 1);

    expect(signature(generateGroupPhaseSchedule({ ...base, hostTeamIds: [], openingMode: 'club-derby' })))
      .toBe(signature(generateGroupPhaseSchedule(base)));
  });
});
