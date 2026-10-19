/**
 * Runden-Spielplan auf einem Feld – Tests aus dem Gherkin des Records
 * docs/anforderungen/2026-09-27_wizard-zeitrahmen-fairness.md:
 * @W4-029, @W4-030, @W4-031, @W4-032 (Grundriss), @W4-036, @W4-037, @W4-038, @W4-039.
 *
 * „Plan ohne Rundenplan-Vorschlag“ = generateGreedyGroupPhaseSchedule (dieselbe Eingabe, derselbe Stand).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateGreedyGroupPhaseSchedule,
  generateGroupPhaseSchedule,
  generateGroupPhaseScheduleWithReport,
} from '../fairScheduler';
import {
  DFB_MIN_GAMES_BETWEEN,
  consecutiveSlotDoubles,
  homeAwayStats,
  longestPauseGames,
  longestPauseMinutes,
  minGamesBetween,
  playedTimeline,
  scenarioOptions,
  shortGapSpots,
  signature,
  teamIdsOf,
} from './roundsScenarioHelpers';

const TEAM_COUNTS = Array.from({ length: 12 }, (_, i) => i + 5); // 5 … 16
const SLOW_TIMEOUT_MS = 60_000;

afterEach(() => { vi.restoreAllMocks(); });

/** Uhr, die bei jedem Aufruf eine Minute weiterspringt („künstlich verlangsamt“). */
function slowDownClock(): void {
  let fakeNow = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => { fakeNow += 60_000; return fakeNow; });
  vi.spyOn(Date, 'now').mockImplementation(() => { fakeNow += 60_000; return fakeNow; });
}

describe('@W4-029 Bei einer Gruppe auf einem Feld haben nach jeder Runde alle Teams gleich viele Spiele', () => {
  it('6 Teams: gleich viele Spiele nach Spiel 3, 6, 9, 12, 15; nie mehr als 1 Spiel Unterschied', () => {
    const options = scenarioOptions([6], 1);
    const timeline = playedTimeline(generateGroupPhaseSchedule(options), teamIdsOf(options));

    expect(timeline.equalAfter).toEqual(expect.arrayContaining([3, 6, 9, 12, 15]));
    expect(timeline.maxDiff).toBeLessThanOrEqual(1);
  });

  it('6 Teams: gleiche Eingabe ergibt denselben Spielplan', () => {
    expect(signature(generateGroupPhaseSchedule(scenarioOptions([6], 1))))
      .toBe(signature(generateGroupPhaseSchedule(scenarioOptions([6], 1))));
  });

  it('6 Teams: mit künstlich verlangsamter Uhr entsteht derselbe Plan', () => {
    const normal = signature(generateGroupPhaseSchedule(scenarioOptions([6], 1)));
    slowDownClock();
    expect(signature(generateGroupPhaseSchedule(scenarioOptions([6], 1)))).toBe(normal);
  });

  it.each(TEAM_COUNTS.filter((n) => n % 2 === 0))(
    'Eigenschaft %i Teams: nach jeder Runde (alle n/2 Spiele) gleich viele Spiele, Unterschied ≤ 1',
    (n) => {
      const options = scenarioOptions([n], 1);
      const timeline = playedTimeline(generateGroupPhaseSchedule(options), teamIdsOf(options));
      const roundEnds = Array.from({ length: n - 1 }, (_, r) => (r + 1) * (n / 2));

      expect(timeline.equalAfter).toEqual(expect.arrayContaining(roundEnds));
      expect(timeline.maxDiff).toBeLessThanOrEqual(1);
    },
    SLOW_TIMEOUT_MS,
  );

  it.each(TEAM_COUNTS)('Eigenschaft %i Teams: verlangsamte Uhr ändert den Plan nicht', (n) => {
    const normal = signature(generateGroupPhaseSchedule(scenarioOptions([n], 1)));
    slowDownClock();
    expect(signature(generateGroupPhaseSchedule(scenarioOptions([n], 1)))).toBe(normal);
  }, SLOW_TIMEOUT_MS);
});

describe('@W4-030 Kein Team spielt öfter als zweimal hintereinander auf derselben Seite', () => {
  it('6 Teams: jedes Team 2 oder 3 Heimspiele, nie dreimal hintereinander Heim oder Gast', () => {
    const stats = homeAwayStats(generateGroupPhaseSchedule(scenarioOptions([6], 1)));

    expect(stats.size).toBe(6);
    stats.forEach((s) => {
      expect([2, 3]).toContain(s.home);
      expect(s.longestStreak).toBeLessThanOrEqual(2);
    });
  });
});

describe('@W4-031 Die Pause zwischen zwei Spielen ist mindestens so lang wie im DFB-Schlüssel', () => {
  it.each(TEAM_COUNTS)('Eigenschaft %i Teams auf einem Feld: Mindestabstand wie DFB-Schlüssel', (n) => {
    expect(minGamesBetween(generateGroupPhaseSchedule(scenarioOptions([n], 1)))).toBeGreaterThanOrEqual(DFB_MIN_GAMES_BETWEEN[n]);
  }, SLOW_TIMEOUT_MS);
});

describe('@W4-036 Bei ungerader Teamzahl auf einem Feld liegt kein Team mehr als ein Spiel zurück', () => {
  it('5 Teams: Unterschied ≤ 1, gleich nach Spiel 5 und 10, genau 2 Heimspiele, kein Doppelspiel', () => {
    const options = scenarioOptions([5], 1);
    const matches = generateGroupPhaseSchedule(options);
    const timeline = playedTimeline(matches, teamIdsOf(options));

    expect(timeline.maxDiff).toBeLessThanOrEqual(1);
    expect(timeline.equalAfter).toEqual(expect.arrayContaining([5, 10]));
    homeAwayStats(matches).forEach((s) => { expect(s.home).toBe(2); });
    expect(minGamesBetween(matches)).toBeGreaterThanOrEqual(1);
  });

  it.each(TEAM_COUNTS.filter((n) => n % 2 === 1))(
    'Eigenschaft %i Teams: Unterschied ≤ 1, gleich nach jedem Vielfachen von n, je (n−1)/2 Heimspiele',
    (n) => {
      const options = scenarioOptions([n], 1);
      const matches = generateGroupPhaseSchedule(options);
      const timeline = playedTimeline(matches, teamIdsOf(options));
      const multiples = Array.from({ length: (n - 1) / 2 }, (_, i) => (i + 1) * n);

      expect(timeline.maxDiff).toBeLessThanOrEqual(1);
      expect(timeline.equalAfter).toEqual(expect.arrayContaining(multiples));
      homeAwayStats(matches).forEach((s) => { expect(s.home).toBe((n - 1) / 2); });
      expect(minGamesBetween(matches)).toBeGreaterThanOrEqual(1);
    },
    SLOW_TIMEOUT_MS,
  );
});

describe('@W4-037 Ein Plan mit Gleichstand nach jeder Runde geht vor, solange keine Pause länger wird', () => {
  it('7 Teams: Abstand ≥ 2, gleich nach Spiel 7, 14, 21, längste Pause nicht länger als ohne Rundenplan', () => {
    const options = scenarioOptions([7], 1);
    const matches = generateGroupPhaseSchedule(options);
    const ohne = generateGreedyGroupPhaseSchedule(options);

    expect(minGamesBetween(matches)).toBeGreaterThanOrEqual(2);
    expect(playedTimeline(matches, teamIdsOf(options)).equalAfter).toEqual(expect.arrayContaining([7, 14, 21]));
    expect(longestPauseGames(matches)).toBeLessThanOrEqual(longestPauseGames(ohne));
  });

  it.each(TEAM_COUNTS)('Eigenschaft %i Teams: längste Pause nie länger als im Plan ohne Rundenplan-Vorschlag', (n) => {
    const options = scenarioOptions([n], 1);
    expect(longestPauseGames(generateGroupPhaseSchedule(options)))
      .toBeLessThanOrEqual(longestPauseGames(generateGreedyGroupPhaseSchedule(options)));
  }, SLOW_TIMEOUT_MS);
});

describe('@W4-038 Zwei Gruppen zu je 6 Teams auf einem Feld laufen in gemeinsamen Runden', () => {
  it('gleich nach Spiel 6, 12, 18, 24, 30; längste Pause ≤ 6 Spiele; Heim/Gast 2–3, Serie ≤ 2', () => {
    const options = scenarioOptions([6, 6], 1);
    const matches = generateGroupPhaseSchedule(options);

    expect(playedTimeline(matches, teamIdsOf(options)).equalAfter).toEqual(expect.arrayContaining([6, 12, 18, 24, 30]));
    expect(longestPauseGames(matches)).toBeLessThanOrEqual(6);
    const stats = homeAwayStats(matches);
    expect(stats.size).toBe(12);
    stats.forEach((s) => {
      expect([2, 3]).toContain(s.home);
      expect(s.longestStreak).toBeLessThanOrEqual(2);
    });
  });
});

describe('@W4-039 Findet die App im Rechenbudget keinen Plan mit DFB-Abstand, wird nichts still schlechter', () => {
  // Kleines Knotenbudget: darin wird für 15 Teams kein Plan mit 6 Spielen Abstand gefunden.
  const TINY_BUDGET = 200;

  it('15 Teams, kleines Budget: nicht schlechter als ohne Rundenplan und die Stellen werden gemeldet', () => {
    const options = scenarioOptions([15], 1, { roundsNodeBudget: TINY_BUDGET });
    const result = generateGroupPhaseScheduleWithReport(options);
    const ohne = generateGreedyGroupPhaseSchedule(options);
    const ids = teamIdsOf(options);

    expect(minGamesBetween(result.matches)).toBeLessThan(6); // Vorbedingung: im Budget kein DFB-Abstand
    expect(longestPauseGames(result.matches)).toBeLessThanOrEqual(longestPauseGames(ohne));
    expect(playedTimeline(result.matches, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
    expect(consecutiveSlotDoubles(result.matches)).toBeLessThanOrEqual(consecutiveSlotDoubles(ohne));

    const reported = result.notices
      .filter((n) => n.kind === 'dfbGapShortfall')
      .map((n) => `${n.teamId}@${n.matchNumber}`)
      .sort();
    expect(reported.length).toBeGreaterThan(0);
    expect(reported).toEqual(shortGapSpots(result.matches, 6));
  }, SLOW_TIMEOUT_MS);

  it('Gegenbeispiel: mit dem normalen Budget gibt es keinen kürzeren Abstand und keine Meldung', () => {
    const result = generateGroupPhaseScheduleWithReport(scenarioOptions([15], 1));

    expect(minGamesBetween(result.matches)).toBeGreaterThanOrEqual(6);
    expect(result.notices.filter((n) => n.kind === 'dfbGapShortfall')).toEqual([]);
  }, SLOW_TIMEOUT_MS);
});

describe('@W4-032 Wo ein Rundenplan nichts bringt, wird der Spielplan nicht schlechter als ohne Rundenplan-Vorschlag', () => {
  it.each([
    { aufbau: '2 Gruppen zu je 5 Teams auf einem Feld', sizes: [5, 5], fields: 1, pauseGames: 5, diff: 2, doppel: 0 },
    { aufbau: '4 Teams auf einem Feld', sizes: [4], fields: 1, pauseGames: 2, diff: 1, doppel: 2 },
  ])('$aufbau: Pause ≤ $pauseGames Spiele, Diff ≤ $diff, Doppel ≤ $doppel, keiner schlechter', ({ sizes, fields, pauseGames, diff, doppel }) => {
    const options = scenarioOptions(sizes, fields);
    const matches = generateGroupPhaseSchedule(options);
    const ohne = generateGreedyGroupPhaseSchedule(options);
    const ids = teamIdsOf(options);

    expect(longestPauseGames(matches)).toBeLessThanOrEqual(pauseGames);
    expect(playedTimeline(matches, ids).maxDiff).toBeLessThanOrEqual(diff);
    expect(consecutiveSlotDoubles(matches)).toBeLessThanOrEqual(doppel);
    expect(longestPauseGames(matches)).toBeLessThanOrEqual(longestPauseGames(ohne));
    expect(playedTimeline(matches, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
    expect(consecutiveSlotDoubles(matches)).toBeLessThanOrEqual(consecutiveSlotDoubles(ohne));
  });

  it('6 Teams auf 2 Feldern (10 + 5 Minuten): Pause ≤ 65 Minuten, Diff ≤ 3, Doppel 0, keiner schlechter', () => {
    const options = scenarioOptions([6], 2);
    const matches = generateGroupPhaseSchedule(options);
    const ohne = generateGreedyGroupPhaseSchedule(options);
    const ids = teamIdsOf(options);

    expect(longestPauseMinutes(matches)).toBeLessThanOrEqual(65);
    expect(playedTimeline(matches, ids).maxDiff).toBeLessThanOrEqual(3);
    expect(consecutiveSlotDoubles(matches)).toBe(0);
    expect(longestPauseMinutes(matches)).toBeLessThanOrEqual(longestPauseMinutes(ohne));
    expect(playedTimeline(matches, ids).maxDiff).toBeLessThanOrEqual(playedTimeline(ohne, ids).maxDiff);
    expect(consecutiveSlotDoubles(matches)).toBeLessThanOrEqual(consecutiveSlotDoubles(ohne));
  });
});
