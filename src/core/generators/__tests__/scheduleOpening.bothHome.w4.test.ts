/**
 * „Beide beginnen als Heim“ (@W4-048) und Abstand der Veranstalter-Mannschaften (@W4-050), Generator-Teil.
 * Tests aus dem Gherkin des Records docs/anforderungen/2026-09-27_wizard-zeitrahmen-fairness.md.
 * Die Zählung der Folgen ist hier unabhängig vom Produktivcode (`hostSpacing.ts`) nachgerechnet.
 */
import { describe, expect, it } from 'vitest';
import type { Match, OpeningMode } from '../../../types/tournament';
import { generateGroupPhaseSchedule, generateGroupPhaseScheduleWithReport, type GroupPhaseScheduleOptions } from '../fairScheduler';
import { measurePlanQuality } from '../planQuality';
import { awayOf, homeAwayStats, homeOf, matchNumberOf, ordered, scenarioOptions, signature, teamIdsOf } from './roundsScenarioHelpers';

/** G-Jugend: Waging 1 und 2 sind die letzten beiden der Teamliste. */
function gTeams(options: GroupPhaseScheduleOptions): string[] { return teamIdsOf(options); }

function fairnessOf(matches: Match[]): string {
  const stats = [...homeAwayStats(matches).values()];
  const q = measurePlanQuality(matches);
  return JSON.stringify({
    q,
    streak: Math.max(...stats.map((s) => s.longestStreak)),
    maxHome: Math.max(...stats.map((s) => s.home)),
    minHome: Math.min(...stats.map((s) => s.home)),
  });
}

/** Folgen: ein Spiel nur von a direkt vor einem Spiel nur von b (oder umgekehrt), Vereinsduell zählt nicht. */
function follows(pairs: Array<[string, string]>, a: string, b: string): number {
  let count = 0;
  for (let i = 0; i + 1 < pairs.length; i++) {
    const x = pairs[i];
    const y = pairs[i + 1];
    const onlyA = (p: [string, string]): boolean => p.includes(a) && !p.includes(b);
    const onlyB = (p: [string, string]): boolean => p.includes(b) && !p.includes(a);
    if ((onlyA(x) && onlyB(y)) || (onlyB(x) && onlyA(y))) { count++; }
  }
  return count;
}

const pairsOf = (matches: Match[]): Array<[string, string]> => ordered(matches).map((m) => [homeOf(m), awayOf(m)]);

/**
 * Kleinste Zahl Folgen über ALLE Umbenennungen (geordnete Paare Platz → Waging 1/2, ungespiegelt und gespiegelt) des
 * Plans ohne Markierung, die die Eröffnung erfüllen – unabhängig vom Generator gezählt.
 */
function minimumFollows(base: Match[], ids: string[], mode: OpeningMode): { min: number; max: number; eligible: number } {
  const seq = pairsOf(base);
  const values: number[] = [];
  for (const mirror of [false, true]) {
    const plan = mirror ? seq.map(([h, a]): [string, string] => [a, h]) : seq;
    for (const p of ids) {
      for (const q of ids) {
        if (p === q) { continue; }
        const duel = plan.findIndex((m) => m.includes(p) && m.includes(q)) + 1;
        const [one, two] = plan;
        const guestFirst = one[0] === p && one[1] !== q;
        const ok = mode === 'club-derby' ? one[0] === p && one[1] === q
          : mode === 'guest-opening' ? guestFirst && duel >= 4 && duel <= 6
            : guestFirst && two[0] === q && two[1] !== p;
        if (ok) { values.push(follows(plan, p, q)); }
      }
    }
  }
  return { min: Math.min(...values), max: Math.max(...values), eligible: values.length };
}

describe('@W4-048 Auf Wunsch beginnen beide Mannschaften des Veranstalters als Heim', () => {
  const base = scenarioOptions([6], 1);
  const ids = gTeams(base);
  const [w1, w2] = [ids[4], ids[5]];
  const ohne = generateGroupPhaseSchedule(base);

  it('6 Teams auf einem Feld: Spiel 1 = Waging 1 Heim gegen einen Gast, Spiel 2 = Waging 2 Heim gegen einen Gast', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: 'both-home' });
    const [one, two] = ordered(matches);

    expect(homeOf(one)).toBe(w1);
    expect([w1, w2]).not.toContain(awayOf(one));
    expect(homeOf(two)).toBe(w2);
    expect([w1, w2]).not.toContain(awayOf(two));
    expect(matches).toHaveLength(15);
  });

  it('die Fairness ist dieselbe wie ohne Mannschaften des Veranstalters', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: 'both-home' });

    expect(fairnessOf(matches)).toBe(fairnessOf(ohne));
  });

  it('das Vereinsduell liegt nicht in Spiel 1 oder 2 (die Übersicht nennt die Nummer)', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: 'both-home' });

    expect(matchNumberOf(matches, w1, w2)).toBeGreaterThan(2);
  });

  it('ohne eigene Wahl gilt weiter „Veranstalter gegen einen Gast“ (Gegenbeispiel: nicht both-home)', () => {
    const ohneWahl = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2] });
    const gast = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: 'guest-opening' });
    const beide = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: 'both-home' });

    expect(signature(ohneWahl)).toBe(signature(gast));
    expect(signature(beide)).not.toBe(signature(gast));
    expect(homeOf(ordered(gast)[1])).not.toBe(w2);
  });

  it.each([5, 7, 8, 10])('Eigenschaft %i Teams: beide Heim in Spiel 1 und 2, Fairness wie ohne Markierung', (n) => {
    const options = scenarioOptions([n], 1);
    const all = teamIdsOf(options);
    const [a, b] = [all[n - 2], all[n - 1]];
    const matches = generateGroupPhaseSchedule({ ...options, hostTeamIds: [a, b], openingMode: 'both-home' });
    const [one, two] = ordered(matches);

    expect(homeOf(one)).toBe(a);
    expect(homeOf(two)).toBe(b);
    expect([a, b]).not.toContain(awayOf(one));
    expect([a, b]).not.toContain(awayOf(two));
    expect(fairnessOf(matches)).toBe(fairnessOf(generateGroupPhaseSchedule(options)));
  });

  it('geht es nicht auf (drei Markierte): Meldung und Plan nach der Vorgabe', () => {
    const three = [ids[3], ids[4], ids[5]];
    const report = generateGroupPhaseScheduleWithReport({ ...base, hostTeamIds: three, openingMode: 'both-home' });
    const vorgabe = generateGroupPhaseSchedule({ ...base, hostTeamIds: three, openingMode: 'guest-opening' });

    expect(report.notices.map((n) => n.kind)).toContain('hostBothHomeNotPossible');
    expect(signature(report.matches)).toBe(signature(vorgabe));
  });

  it('Gegenbeispiel: aufgegangen = keine Meldung', () => {
    const report = generateGroupPhaseScheduleWithReport({ ...base, hostTeamIds: [w1, w2], openingMode: 'both-home' });

    expect(report.notices.filter((n) => n.kind === 'hostBothHomeNotPossible')).toEqual([]);
  });

  it('wo kein Rundenplan entsteht (2 Felder), wirkt die Wahl nicht (@W4-041)', () => {
    const two = scenarioOptions([6], 2);
    const [a, b] = [teamIdsOf(two)[4], teamIdsOf(two)[5]];
    const beide = generateGroupPhaseSchedule({ ...two, hostTeamIds: [a, b], openingMode: 'both-home' });
    const gast = generateGroupPhaseSchedule({ ...two, hostTeamIds: [a, b], openingMode: 'guest-opening' });

    expect(signature(beide)).toBe(signature(gast));
  });
});

describe('@W4-050 Die Mannschaften des Veranstalters spielen möglichst selten direkt nacheinander', () => {
  const base = scenarioOptions([6], 1);
  const ids = gTeams(base);
  const [w1, w2] = [ids[4], ids[5]];
  const ohne = generateGroupPhaseSchedule(base);

  it.each(['guest-opening', 'club-derby', 'both-home'] as const)('%s: Zahl der Folgen ist das Minimum über alle zulässigen Umbenennungen', (mode) => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1, w2], openingMode: mode });
    const expected = minimumFollows(ohne, ids, mode);

    expect(expected.eligible).toBeGreaterThan(0);
    expect(follows(pairsOf(matches), w1, w2)).toBe(expected.min);
    expect(fairnessOf(matches)).toBe(fairnessOf(ohne));
  });

  it('Gegenbeispiel: das Minimum ist nicht überall erreicht – es gibt zulässige Umbenennungen mit mehr Folgen', () => {
    const spread = (['guest-opening', 'club-derby', 'both-home'] as const).map((mode) => minimumFollows(ohne, ids, mode));

    expect(spread.some((s) => s.max > s.min)).toBe(true);
  });

  it('ohne Markierung ist der Plan bitgleich wie mit leerer Liste', () => {
    expect(signature(generateGroupPhaseSchedule({ ...base, hostTeamIds: [] }))).toBe(signature(ohne));
  });

  it('mit genau einer Markierung bleibt nur der Tausch der Heimmannschaft von Spiel 1 (Plan sonst wie ohne)', () => {
    const matches = generateGroupPhaseSchedule({ ...base, hostTeamIds: [w1] });
    const first = homeOf(ordered(ohne)[0]);
    const swap = (id: string): string => (id === first ? w1 : id === w1 ? first : id);
    const expected = ordered(ohne).map((m) => `${m.slot}:${m.field}:${swap(homeOf(m))}-${swap(awayOf(m))}:${m.group}`).join('|');

    expect(signature(matches)).toBe(expected);
  });
});
