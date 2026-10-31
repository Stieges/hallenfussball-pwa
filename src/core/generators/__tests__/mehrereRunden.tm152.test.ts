/**
 * @TM-152 – Bei „Jeder gegen jeden“ legt die Rundenzahl fest, wie oft jede Paarung gespielt wird
 * (Record 2026-10-01_turniermodi). Tests aus dem Gherkin, über den ganzen Erzeugungsweg (`generateFullSchedule`):
 * - Spielzahl 15/30/45 bei 6 Teams, jede Paarung genau ein-/zwei-/dreimal,
 * - in jeder weiteren Runde Heim und Gast gegenüber der Runde davor getauscht (k-tes Spiel einer Paarung = Runde k),
 * - Mindestpause eines Teams über alle Runden (Abstand der Zeitfenster eigener Spiele ≥ Mindestpause + 1).
 * Gegenbeispiele: ohne Rundenzahl eine Runde; „Gruppen + Finalrunde“ bleibt bei einer Runde (@TM-140 später).
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '..';
import type { ScheduledMatch } from '../scheduleTypes';
import type { Tournament } from '../../../types/tournament';
import { createMockTournament, createMockTeams } from '../../../test/factories';
import { effectiveRoundCount, repeatRounds } from '../repeatRounds';
import type { Match } from '../../../types/tournament';

function nikolaus(numberOfRounds: number | undefined, extra: Partial<Tournament> = {}): Tournament {
  return createMockTournament({
    title: 'Nikolaus-Turnier',
    teams: createMockTeams(6, 1),
    numberOfTeams: 6,
    numberOfGroups: 1,
    numberOfFields: 1,
    groupSystem: 'roundRobin',
    finalsConfig: { preset: 'none' },
    numberOfRounds,
    ...extra,
  });
}

const groupMatches = (t: Tournament): ScheduledMatch[] =>
  generateFullSchedule(t).allMatches
    .filter((m) => m.phase === 'groupStage')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.field - b.field);

const pairKey = (m: ScheduledMatch): string => [m.homeTeam, m.awayTeam].sort().join(' | ');

function pairCounts(matches: ScheduledMatch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matches) { counts.set(pairKey(m), (counts.get(pairKey(m)) ?? 0) + 1); }
  return counts;
}

/** Je Paarung die Heimseite in zeitlicher Reihenfolge (k-tes Vorkommen = Runde k). */
function homeSequences(matches: ScheduledMatch[]): Map<string, string[]> {
  const seq = new Map<string, string[]>();
  for (const m of matches) {
    const list = seq.get(pairKey(m)) ?? [];
    list.push(m.homeTeam);
    seq.set(pairKey(m), list);
  }
  return seq;
}

/** Kleinster Abstand (in Zeitfenstern) zwischen zwei eigenen Spielen eines Teams, über alle Teams. */
function minGapInSlots(matches: ScheduledMatch[], slotMinutes: number): number {
  const times = new Map<string, number[]>();
  for (const m of matches) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      const list = times.get(team) ?? [];
      list.push(m.startTime.getTime());
      times.set(team, list);
    }
  }
  let min = Number.POSITIVE_INFINITY;
  for (const list of times.values()) {
    list.sort((a, b) => a - b);
    for (let i = 1; i < list.length; i++) { min = Math.min(min, (list[i] - list[i - 1]) / 60_000 / slotMinutes); }
  }
  return min;
}

describe('@TM-152 Rundenzahl bei „Jeder gegen jeden“ (Nikolaus-Turnier, 6 Teams)', () => {
  it.each([
    { label: 'eine Runde', rounds: 1, spiele: 15, haeufigkeit: 1 },
    { label: 'zwei Runden', rounds: 2, spiele: 30, haeufigkeit: 2 },
    { label: 'drei Runden', rounds: 3, spiele: 45, haeufigkeit: 3 },
  ])('@TM-152 $label: $spiele Spiele, jede Paarung genau $haeufigkeit-mal', ({ rounds, spiele, haeufigkeit }) => {
    const matches = groupMatches(nikolaus(rounds));

    expect(matches).toHaveLength(spiele);
    const counts = pairCounts(matches);
    expect(counts.size).toBe(15);
    expect([...counts.values()].every((c) => c === haeufigkeit)).toBe(true);
  });

  it.each([2, 3])('@TM-152 %i Runden: in jeder weiteren Runde sind Heim und Gast gegenüber der Runde davor getauscht', (rounds) => {
    const matches = groupMatches(nikolaus(rounds));

    for (const [pair, homes] of homeSequences(matches)) {
      expect(homes, pair).toHaveLength(rounds);
      for (let k = 1; k < homes.length; k++) {
        expect(homes[k], `${pair} Runde ${k + 1}`).not.toBe(homes[k - 1]);
      }
    }
  });

  it.each([1, 2, 3])('@TM-152 %i Runde(n): die Mindestpause (1 Spiel) gilt über alle Runden hinweg', (rounds) => {
    const t = nikolaus(rounds, { minRestSlots: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2 });
    const matches = groupMatches(t);

    // Mindestpause 1 = zwischen zwei eigenen Spielen liegt mindestens ein Zeitfenster → Abstand ≥ 2 Fenster
    expect(minGapInSlots(matches, 12)).toBeGreaterThanOrEqual(2);
  });

  it('@TM-152 die Mindestpause gilt auch über die Rundengrenze bei anderen Teamzahlen und 2 Feldern', () => {
    for (const teams of [5, 6, 7, 8, 9, 10]) {
      for (const fields of [1, 2]) {
        const base = createMockTournament({
          teams: createMockTeams(teams, 1), numberOfTeams: teams, numberOfFields: fields, groupSystem: 'roundRobin',
          finalsConfig: { preset: 'none' }, minRestSlots: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 0,
        });
        // Bezug: was die erste Runde allein schafft, muss über drei Runden ebenso gelten
        const single = minGapInSlots(groupMatches({ ...base, numberOfRounds: 1 }), 10);
        const triple = minGapInSlots(groupMatches({ ...base, numberOfRounds: 3 }), 10);
        expect(triple, `${teams} Teams, ${fields} Feld(er)`).toBeGreaterThanOrEqual(Math.min(single, 2));
      }
    }
  });

  it('@TM-152 Gegenbeispiel: ohne eingestellte Rundenzahl gibt es eine Runde (15 Spiele, jede Paarung einmal)', () => {
    const matches = groupMatches(nikolaus(undefined));

    expect(matches).toHaveLength(15);
    expect([...pairCounts(matches).values()].every((c) => c === 1)).toBe(true);
  });

  it('@TM-152 Gegenbeispiel: bei „Gruppen + Finalrunde“ wirkt eine gespeicherte Rundenzahl nicht (@TM-140 später)', () => {
    const gruppen = (numberOfRounds: number | undefined): Tournament => createMockTournament({
      teams: createMockTeams(8, 2), numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1,
      groupSystem: 'groupsAndFinals', finalsConfig: { preset: 'none' }, numberOfRounds,
    });
    const einfach = groupMatches(gruppen(undefined));
    const mitDrei = groupMatches(gruppen(3));

    expect(einfach).toHaveLength(12);
    expect(mitDrei).toHaveLength(12);
    expect([...pairCounts(mitDrei).values()].every((c) => c === 1)).toBe(true);
    expect(effectiveRoundCount({ groupSystem: 'groupsAndFinals', numberOfRounds: 3 })).toBe(1);
  });

  it('@TM-152 lässt sich die Mindestpause schon in der ersten Runde nicht einhalten, gilt über die Rundengrenze dieselbe Pause wie in der ersten Runde', () => {
    let ersteRundeVerfehlt = 0;
    for (const [teams, fields] of [[7, 2], [5, 1], [9, 2], [10, 3]] as const) {
      const base = createMockTournament({
        teams: createMockTeams(teams, 1), numberOfTeams: teams, numberOfFields: fields, groupSystem: 'roundRobin',
        finalsConfig: { preset: 'none' }, minRestSlots: 2, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 0,
      });
      const single = minGapInSlots(groupMatches({ ...base, numberOfRounds: 1 }), 10);
      const double = minGapInSlots(groupMatches({ ...base, numberOfRounds: 2 }), 10);
      if (single < 3) { ersteRundeVerfehlt++; }
      expect(double, `${String(teams)} Teams, ${String(fields)} Feld(er)`).toBeGreaterThanOrEqual(Math.min(single, 3));
    }
    // die Lage des Szenarios kommt wirklich vor (Runde 1 schafft Mindestpause 2 nicht)
    expect(ersteRundeVerfehlt).toBeGreaterThan(0);
  });

  it('@TM-152 Rechenbudget: auch große Turniere mit hoher Mindestpause brauchen für 10 Runden unter 500 ms', () => {
    for (const [teams, fields, rest] of [[16, 4, 3], [14, 2, 3], [7, 1, 3], [24, 3, 2]] as const) {
      const t = createMockTournament({
        teams: createMockTeams(teams, 1), numberOfTeams: teams, numberOfFields: fields, groupSystem: 'roundRobin',
        finalsConfig: { preset: 'none' }, minRestSlots: rest, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 0,
      });
      const firstRound = generateFullSchedule({ ...t, numberOfRounds: 1 }).allMatches as unknown as Match[];
      const started = performance.now();
      const all = repeatRounds(firstRound, 10, { minRestSlots: rest, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0 });
      const elapsed = performance.now() - started;
      expect(all).toHaveLength(firstRound.length * 10);
      expect(elapsed, `${String(teams)} Teams, ${String(fields)} Felder, Pause ${String(rest)}`).toBeLessThan(500);
    }
  });

  it('@TM-152 jede Runde ist vollständig gespielt, bevor die nächste beginnt (3 Runden, k-tes Spiel einer Paarung = Runde k)', () => {
    for (const fields of [1, 2]) {
      const matches = groupMatches(nikolaus(3, { numberOfFields: fields }));
      const roundOf = new Map<ScheduledMatch, number>();
      const seen = new Map<string, number>();
      for (const m of matches) {
        const k = (seen.get(pairKey(m)) ?? 0) + 1;
        seen.set(pairKey(m), k);
        roundOf.set(m, k);
      }
      for (const k of [1, 2]) {
        const lastEnd = Math.max(...matches.filter((m) => roundOf.get(m) === k).map((m) => m.endTime.getTime()));
        const nextStart = Math.min(...matches.filter((m) => roundOf.get(m) === k + 1).map((m) => m.startTime.getTime()));
        expect(lastEnd, `${String(fields)} Feld(er), Runde ${String(k)}`).toBeLessThanOrEqual(nextStart);
      }
    }
  });
});
