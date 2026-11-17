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
  minSlotsBetween,
  matchNumberOf,
  minGamesBetween,
  ordered,
  playedTimeline,
  scenarioOptions,
  signature,
  slotCount,
  teamIdsOf,
} from './roundsScenarioHelpers';

/** Die ersten beiden Teams der ersten Gruppe heißen im Szenario „TSV Waging 1“ und „TSV Waging 2“. */
function waging(options: GroupPhaseScheduleOptions, group = 0): { eins: string; zwei: string } {
  const teams = [...options.groups.values()][group];
  return { eins: teams[0].id, zwei: teams[1].id };
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
  ])('$aufbau: eins und zwei markiert → eine von beiden ist in Spiel 1 Heimmannschaft', ({ sizes, fields }) => {
    const base = scenarioOptions(sizes, fields);
    const { eins, zwei } = waging(base);
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei] });

    expect([eins, zwei]).toContain(homeOf(firstMatch(matches)));
  });

  it('ohne markierte Mannschaft ist der Plan derselbe wie mit leerer Liste', () => {
    const base = scenarioOptions([6], 1);

    expect(signature(generateGroupPhaseSchedule({ ...base, hostTeamIds: [] })))
      .toBe(signature(generateGroupPhaseSchedule(base)));
  });
});

describe('@W4-033 Bei zwei Mannschaften des Veranstalters wählt die Turnierleitung das Eröffnungsspiel', () => {
  const base = scenarioOptions([6], 1);
  const { eins, zwei } = waging(base);
  const ids = teamIdsOf(base);
  const ohneMarkierung = fairness(generateGroupPhaseSchedule(base), ids);

  it('„Vereinsduell eröffnet“: Spiel 1 ist eins gegen zwei', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei], openingMode: 'club-derby' });

    expect([homeOf(firstMatch(matches)), awayOf(firstMatch(matches))]).toEqual([eins, zwei]);
    expect(fairness(matches, ids)).toEqual(ohneMarkierung);
  });

  it('„Veranstalter gegen einen Gast“: Waging als Heim gegen einen Gast, Vereinsduell in Spiel 4 bis 6', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei], openingMode: 'guest-opening' });

    expect([eins, zwei]).toContain(homeOf(firstMatch(matches)));
    expect([eins, zwei]).not.toContain(awayOf(firstMatch(matches)));
    expect(matchNumberOf(matches, eins, zwei)).toBeGreaterThanOrEqual(4);
    expect(matchNumberOf(matches, eins, zwei)).toBeLessThanOrEqual(6);
    expect(fairness(matches, ids)).toEqual(ohneMarkierung);
  });

  it('ohne eigene Wahl gilt „Veranstalter gegen einen Gast, Vereinsduell in Runde 2“', () => {
    const ohneWahl = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei] });
    const gastEroeffnung = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei], openingMode: 'guest-opening' });

    expect(signature(ohneWahl)).toBe(signature(gastEroeffnung));
  });

  it.each([5, 7, 8, 9, 10])('Eigenschaft %i Teams: beide Wahlen wirken, Fairness wie ohne Markierung', (n) => {
    const options = scenarioOptions([n], 1);
    const pair = waging(options);
    const allIds = teamIdsOf(options);
    const reference = fairness(generateGroupPhaseSchedule(options), allIds);
    const perRound = Math.floor(n / 2);

    const derby = generateGroupPhaseSchedule({ ...options, hostTeamIds: [pair.eins, pair.zwei], openingMode: 'club-derby' });
    expect(matchNumberOf(derby, pair.eins, pair.zwei)).toBe(1);
    expect(homeOf(firstMatch(derby))).toBe(pair.eins);
    expect(fairness(derby, allIds)).toEqual(reference);

    const guest = generateGroupPhaseSchedule({ ...options, hostTeamIds: [pair.eins, pair.zwei], openingMode: 'guest-opening' });
    expect([pair.eins, pair.zwei]).toContain(homeOf(firstMatch(guest)));
    expect(matchNumberOf(guest, pair.eins, pair.zwei)).toBeGreaterThan(perRound);
    expect(matchNumberOf(guest, pair.eins, pair.zwei)).toBeLessThanOrEqual(2 * perRound);
    expect(fairness(guest, allIds)).toEqual(reference);
  });

  it('stehen beide in verschiedenen Gruppen, entfällt die Wahl und eine von ihnen eröffnet als Heim', () => {
    const groups = scenarioOptions([6, 6], 1);
    const einsA = waging(groups, 0).eins;
    const zweiB = waging(groups, 1).eins;
    const allIds = teamIdsOf(groups);
    const reference = fairness(generateGroupPhaseSchedule(groups), allIds);

    for (const openingMode of ['club-derby', 'guest-opening'] as const) {
      const matches = generateGroupPhaseSchedule({ ...groups, hostTeamIds: [einsA, zweiB], openingMode });
      expect([einsA, zweiB]).toContain(homeOf(firstMatch(matches)));
      expect(fairness(matches, allIds)).toEqual(reference);
    }
  });
});

describe('@W4-041 Wo kein Rundenplan entsteht, wirkt die Wahl des Eröffnungsspiels nicht (Generator-Teil)', () => {
  it('6 Teams auf 2 Feldern: beide Wahlen ergeben denselben Plan, eine Waging-Mannschaft eröffnet als Heim', () => {
    const base = scenarioOptions([6], 2);
    const { eins, zwei } = waging(base);
    const derby = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei], openingMode: 'club-derby' });
    const guest = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins, zwei], openingMode: 'guest-opening' });

    expect(signature(derby)).toBe(signature(guest));
    expect([eins, zwei]).toContain(homeOf(firstMatch(derby)));
  });
});

describe('@W4-042 Bei mehreren Feldern eröffnet die Mannschaft des Veranstalters auf Feld 1', () => {
  it('6 Teams auf 2 Feldern: eins spielt in Spiel 1 auf Feld 1 im ersten Zeitfenster als Heim', () => {
    const base = scenarioOptions([6], 2);
    const { eins } = waging(base);
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins] });
    const first = firstMatch(mit);

    expect(first.field).toBe(1);
    expect(first.slot).toBe(0);
    expect(homeOf(first)).toBe(eins);
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
  it.each([0, 2, 4])('2 Gruppen zu je 5 Teams, eins = Team %i aus Gruppe B → Spiel 1 als Heim, nicht unfairer', (index) => {
    const base = scenarioOptions([5, 5], 1);
    const eins = [...base.groups.values()][1][index].id;
    const ids = teamIdsOf(base);
    const ohne = generateGroupPhaseSchedule(base);
    const mit = generateGroupPhaseSchedule({ ...base, hostTeamIds: [eins] });

    expect(homeOf(firstMatch(mit))).toBe(eins);
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

/**
 * Erwartete Meldung zu @W4-045: genau die Verschlechterungen gegenüber dem Plan ohne Markierung, sonst keine Meldung.
 * Pausen als Zeitfenster zwischen zwei eigenen Spielen (auf einem Feld = Spiele), Dauer im 15-Minuten-Raster.
 */
function expectedCosts(host: string, ohne: Match[], mit: Match[], options: GroupPhaseScheduleOptions): unknown[] {
  const ids = teamIdsOf(options);
  const pause = { before: longestSlotsBetween(ohne), after: longestSlotsBetween(mit) };
  const diff = { before: playedTimeline(ohne, ids).maxDiff, after: playedTimeline(mit, ids).maxDiff };
  const slots = { before: slotCount(ohne), after: slotCount(mit) };
  const step = options.slotDurationMinutes + options.breakBetweenSlotsMinutes;
  const start = options.startTime?.getTime() ?? 0;
  const notice: Record<string, unknown> = { kind: 'hostOpeningCosts', teamId: host };
  if (slots.after > slots.before) {
    notice.duration = {
      slotsBefore: slots.before,
      slotsAfter: slots.after,
      extraMinutes: (slots.after - slots.before) * step,
      groupPhaseEndAfter: new Date(start + ((slots.after - 1) * step + options.slotDurationMinutes) * 60_000),
    };
  }
  if (pause.after > pause.before) { notice.longestPause = pause; }
  if (diff.after > diff.before) { notice.playedDiff = diff; }
  return Object.keys(notice).length > 2 ? [notice] : [];
}

function hostCases(sizes: number[], fields: number, minRest: number): Array<{ index: number }> {
  return teamIdsOf(scenarioOptions(sizes, fields, { minRestSlotsPerTeam: minRest })).map((_, index) => ({ index }));
}

describe('@W4-045 Geht die Eröffnung durch den Veranstalter nur mit längerer Pause, eröffnet er trotzdem und die App sagt es', () => {
  const setups = [
    { aufbau: '4+3 auf einem Feld', sizes: [4, 3], fields: 1, minRest: 1 },
    { aufbau: '5+4 auf 2 Feldern', sizes: [5, 4], fields: 2, minRest: 1 },
    { aufbau: '6+4 auf 3 Feldern, Mindestpause 2', sizes: [6, 4], fields: 3, minRest: 2 },
  ];

  describe.each(setups)('$aufbau', ({ sizes, fields, minRest }) => {
    const base = scenarioOptions(sizes, fields, { minRestSlotsPerTeam: minRest });
    const ids = teamIdsOf(base);
    const ohne = generateGroupPhaseScheduleWithReport(base).matches;

    it.each(hostCases(sizes, fields, minRest))('markiert Team $index: eröffnet als Heim, Meldung nennt jede Verschlechterung, Mindestpause hart', ({ index }) => {
      const host = ids[index];
      const result = generateGroupPhaseScheduleWithReport({ ...base, hostTeamIds: [host] });

      expect(homeOf(firstMatch(result.matches))).toBe(host);
      expect(result.notices.filter((n) => n.kind === 'hostOpeningNotPossible')).toEqual([]);
      expect(minSlotsBetween(result.matches)).toBeGreaterThanOrEqual(minRest);
      expect(result.notices.filter((n) => n.kind === 'hostOpeningCosts')).toEqual(expectedCosts(host, ohne, result.matches, base));
    });
  });

  it('4+3 auf einem Feld: mindestens eine Markierung verlängert die längste Pause; Zeitfenster und Unterschied wachsen nicht (so fair wie möglich)', () => {
    const base = scenarioOptions([4, 3], 1);
    const ids = teamIdsOf(base);
    const ohne = generateGroupPhaseSchedule(base);
    const plans = ids.map((host) => generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] }));

    expect(plans.some((mit) => longestSlotsBetween(mit) > longestSlotsBetween(ohne))).toBe(true);
    for (const mit of plans) {
      expect(slotCount(mit)).toBeLessThanOrEqual(slotCount(ohne));
      expect(playedTimeline(mit, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
    }
  });

  it('5+4 auf 2 Feldern: mindestens eine Markierung kostet 1 Zeitfenster (Beispiel aus dem Gherkin)', () => {
    const base = scenarioOptions([5, 4], 2);
    const ohne = generateGroupPhaseSchedule(base);
    const extra = teamIdsOf(base).map((host) => slotCount(generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] })) - slotCount(ohne));

    expect(extra).toContain(1);
    expect(Math.max(...extra)).toBe(1);
  });

  describe.each([
    { aufbau: '7+4 auf 2 Feldern', fields: 2, minRest: 1 },
    { aufbau: '7+4 auf einem Feld, Mindestpause 2', fields: 1, minRest: 2 },
  ])('Kürzere Dauer geht vor kürzerer längster Pause: $aufbau, Veranstalter in der Vierergruppe', ({ fields, minRest }) => {
    const base = scenarioOptions([7, 4], fields, { minRestSlotsPerTeam: minRest });
    const ohne = generateGroupPhaseSchedule(base);
    const vierer = [...base.groups.values()][1].map((team) => team.id);
    const results = vierer.map((host) => ({ host, result: generateGroupPhaseScheduleWithReport({ ...base, hostTeamIds: [host] }) }));

    it.each(vierer.map((_, index) => ({ index })))('Vierer-Team $index: eröffnet als Heim, keine längere Dauer, Pause höchstens 1 länger', ({ index }) => {
      const { host, result } = results[index];
      const costs = result.notices.filter((n) => n.kind === 'hostOpeningCosts');

      expect(homeOf(firstMatch(result.matches))).toBe(host);
      expect(slotCount(result.matches)).toBe(slotCount(ohne));
      expect(costs.every((n) => n.duration === undefined)).toBe(true);
      for (const n of costs) {
        expect(n.longestPause).toEqual({ before: longestSlotsBetween(ohne), after: longestSlotsBetween(ohne) + 1 });
      }
    });

    it('mindestens ein Vierer-Team: die Meldung nennt die um 1 längere Pause', () => {
      expect(results.some(({ result }) => result.notices.some((n) => n.kind === 'hostOpeningCosts' && n.longestPause !== undefined))).toBe(true);
    });
  });

  it('6+4 auf 3 Feldern, Mindestpause 2: mindestens eine Markierung verlängert die Dauer', () => {
    const base = scenarioOptions([6, 4], 3, { minRestSlotsPerTeam: 2 });
    const ohne = generateGroupPhaseSchedule(base);

    expect(teamIdsOf(base).some((host) => slotCount(generateGroupPhaseSchedule({ ...base, hostTeamIds: [host] })) > slotCount(ohne))).toBe(true);
  });
});

describe('@W4-044 Eine gelöschte oder abgewählte Mannschaft des Veranstalters hinterlässt keine Regel (Generator-Teil)', () => {
  it('zwei gelöscht: die verwaiste Markierung wird ignoriert, es gilt nur eins', () => {
    const base = scenarioOptions([7], 1);
    const { eins, zwei } = waging(base);
    const ohneZwei = new Map([...base.groups].map(([key, teams]) => [key, teams.filter((t) => t.id !== zwei)]));
    const options = { ...base, groups: ohneZwei };

    const verwaist = generateGroupPhaseSchedule({ ...options, hostTeamIds: [eins, zwei], openingMode: 'club-derby' });
    const nurEins = generateGroupPhaseSchedule({ ...options, hostTeamIds: [eins] });

    expect(signature(verwaist)).toBe(signature(nurEins));
    expect(homeOf(firstMatch(verwaist))).toBe(eins);
  });

  it('auch eins abgewählt: derselbe Plan wie ohne Markierung', () => {
    const base = scenarioOptions([6], 1);

    expect(signature(generateGroupPhaseSchedule({ ...base, hostTeamIds: [], openingMode: 'club-derby' })))
      .toBe(signature(generateGroupPhaseSchedule(base)));
  });
});
