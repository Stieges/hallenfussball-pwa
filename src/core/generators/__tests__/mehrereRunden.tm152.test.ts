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
import { effectiveRoundCount, repeatRounds, ROUND_ORDER_NODE_BUDGET, type RepeatRoundsStats } from '../repeatRounds';
import type { Match } from '../../../types/tournament';
import { matchTeamIds } from '../../models/matchSlot';

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

/** Kleinster Abstand zweier Spiele eines Teams in belegten Zeitfenstern (leere Fenster zählen nicht, wie in der Zeitplanung). */
function minGapInWindows(matches: readonly Match[]): number {
  const windows = [...new Set(matches.map((m) => m.slot ?? m.round - 1))].sort((a, b) => a - b);
  const indexOf = new Map(windows.map((slot, index) => [slot, index]));
  const last = new Map<string, number>();
  let min = Number.POSITIVE_INFINITY;
  for (const m of [...matches].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))) {
    const index = indexOf.get(m.slot ?? m.round - 1) ?? 0;
    for (const team of matchTeamIds(m)) {
      const previous = last.get(team);
      if (previous !== undefined) { min = Math.min(min, index - previous); }
      last.set(team, index);
    }
  }
  return min;
}

/** Runde 1 je Teams/Felder/Pause einmal erzeugen (der Fair-Scheduler ist der teure Teil, nicht die Wiederholung). */
const firstRoundCache = new Map<string, Match[]>();
function firstRoundOf(teams: number, fields: number, rest: number): Match[] {
  const key = `${String(teams)}/${String(fields)}/${String(rest)}`;
  const cached = firstRoundCache.get(key);
  if (cached) { return cached; }
  const t = createMockTournament({
    teams: createMockTeams(teams, 1), numberOfTeams: teams, numberOfFields: fields, groupSystem: 'roundRobin',
    finalsConfig: { preset: 'none' }, minRestSlots: rest, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 0,
  });
  const firstRound = generateFullSchedule({ ...t, numberOfRounds: 1 }).allMatches as unknown as Match[];
  firstRoundCache.set(key, firstRound);
  return firstRound;
}

/**
 * Raster für die Fensterzahl: 3–12 Teams vollständig (1–4 Felder, Pause 0/1), die Kanten 24 Teams und 1/4 Felder,
 * dazu eine feste Stichprobe aus 13–23 Teams (fester Startwert, damit der Lauf reproduzierbar bleibt).
 */
function windowRaster(): Array<[number, number, number]> {
  const cases: Array<[number, number, number]> = [];
  for (let teams = 3; teams <= 12; teams++) {
    for (const fields of [1, 2, 3, 4]) { for (const rest of [0, 1]) { cases.push([teams, fields, rest]); } }
  }
  for (const fields of [1, 4]) { for (const rest of [0, 1]) { cases.push([24, fields, rest]); } }
  let seed = 20261031;
  const next = (n: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 8; i++) { cases.push([13 + next(11), 1 + next(4), next(2)]); }
  return cases;
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

  it.each([
    [10, 4, 2], [11, 2, 3], [11, 3, 2], [11, 3, 3], [11, 4, 2], [11, 4, 3], [13, 4, 2], [14, 4, 2], [14, 4, 3],
    [16, 3, 2], [16, 3, 3], [20, 4, 2], [20, 4, 3], [24, 4, 2],
  ] as const)('@TM-152 dieselbe Pause wie in der ersten Runde auch bei großen Turnieren: %i Teams, %i Felder, Mindestpause %i, 10 Runden', (teams, fields, rest) => {
    const firstRound = firstRoundOf(teams, fields, rest);
    const all = repeatRounds(firstRound, 10, { minRestSlots: rest, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0 });

    expect(all).toHaveLength(firstRound.length * 10);
    expect(minGapInWindows(all)).toBeGreaterThanOrEqual(Math.min(minGapInWindows(firstRound), rest + 1));
  });

  it('@TM-152 Mindestpause 0 und 1: weitere Runden brauchen nie mehr Zeitfenster als die erste (3–12 Teams vollständig, 24 Teams, Stichprobe 13–23; 1–4 Felder; 2/3/4/10 Runden)', () => {
    const abweichungen: string[] = [];
    for (const [teams, fields, rest] of windowRaster()) {
      const firstRound = firstRoundOf(teams, fields, rest);
      const windows = new Set(firstRound.map((m) => m.slot)).size;
      for (const rounds of [2, 3, 4, 10]) {
        const all = repeatRounds(firstRound, rounds, { minRestSlots: rest, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0 });
        const count = new Set(all.map((m) => m.slot)).size;
        if (count !== rounds * windows) { abweichungen.push(`${String(teams)}/${String(fields)}/P${String(rest)}/${String(rounds)}R: ${String(count)} statt ${String(rounds * windows)}`); }
      }
    }
    expect(abweichungen).toEqual([]);
  }, 60_000);

  it('@TM-152 10 Teams, 3 Felder, 3 Runden (Voreinstellung Mindestpause 1): Ende wie 3 × die erste Runde', () => {
    const t = createMockTournament({
      teams: createMockTeams(10, 1), numberOfTeams: 10, numberOfFields: 3, groupSystem: 'roundRobin',
      finalsConfig: { preset: 'none' }, minRestSlots: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    });
    const starts = (rounds: number) => new Set(generateFullSchedule({ ...t, numberOfRounds: rounds }).allMatches.map((m) => m.startTime.getTime())).size;

    expect(starts(3)).toBe(3 * starts(1));
    expect(starts(4)).toBe(4 * starts(1));
  });

  const fieldUse = (matches: readonly Match[], fields: number): number[] =>
    Array.from({ length: fields }, (_, i) => matches.filter((m) => m.field === i + 1).length);

  it.each([3, 10])('@TM-152 Felder wie in der ersten Runde: jede weitere Runde nutzt jedes Feld gleich oft wie Runde 1 (10 Teams, 3 Felder, %i Runden)', (rounds) => {
    const firstRound = firstRoundOf(10, 3, 1);
    const all = repeatRounds(firstRound, rounds, { minRestSlots: 1, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0 });

    expect(fieldUse(all, 3)).toEqual(fieldUse(firstRound, 3).map((n) => n * rounds));
  });

  it.each([[10, 4, 2], [11, 2, 3], [13, 4, 2]] as const)('@TM-152 mit zusätzlichen Fenstern werden die Felder gleichmäßig verteilt, nicht immer ab Feld 1 (%i Teams, %i Felder, Pause %i, 10 Runden)', (teams, fields, rest) => {
    const firstRound = firstRoundOf(teams, fields, rest);
    const all = repeatRounds(firstRound, 10, { minRestSlots: rest, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0 });
    const spread = (use: number[]): number => Math.max(...use) - Math.min(...use);

    expect(new Set(all.map((m) => m.slot)).size).toBeGreaterThan(10 * new Set(firstRound.map((m) => m.slot)).size);
    expect(spread(fieldUse(all, fields))).toBeLessThanOrEqual(spread(fieldUse(firstRound, fields)) * 10);
  });

  it('@TM-152 Rückfall: reicht das Rechenbudget nicht für die volle Pause, wird sie nur so weit gelockert wie nötig (11 Teams, 2 Felder, Pause 3)', () => {
    const firstRound = firstRoundOf(11, 2, 3);
    expect(minGapInWindows(firstRound)).toBe(3);
    // Budget bewusst knapp: die Suche mit voller Pause scheitert, die mit einem Fenster weniger gelingt
    const all = repeatRounds(firstRound, 2, { minRestSlots: 3, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0, nodeBudget: 150 });

    expect(minGapInWindows(all)).toBe(2);
  });

  it('@TM-152 Rechenbudget: jede Suche bleibt in ihren Suchschritten (gezählt, nicht per Uhr), auch bei großen Turnieren mit hoher Mindestpause', () => {
    for (const [teams, fields, rest] of [[16, 4, 3], [14, 2, 3], [7, 1, 3], [24, 3, 2], [20, 4, 3], [22, 4, 3], [14, 4, 3]] as const) {
      const firstRound = firstRoundOf(teams, fields, rest);
      const stats: RepeatRoundsStats = { searches: 0, maxStepsPerSearch: 0 };
      const started = performance.now();
      const all = repeatRounds(firstRound, 10, { minRestSlots: rest, slotDurationMinutes: 10, breakBetweenSlotsMinutes: 0, stats });
      const label = `${String(teams)} Teams, ${String(fields)} Felder, Pause ${String(rest)}`;
      expect(all, label).toHaveLength(firstRound.length * 10);
      expect(stats.maxStepsPerSearch, label).toBeLessThanOrEqual(ROUND_ORDER_NODE_BUDGET + 1);
      // nur Notbremse gegen Endlosläufe, keine Leistungsmessung (CI-Rechner sind unterschiedlich schnell)
      expect(performance.now() - started, label).toBeLessThan(5_000);
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
