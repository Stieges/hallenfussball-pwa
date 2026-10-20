/**
 * Messgrößen der Szenarien @W4-027 … @W4-044 (Record wizard-zeitrahmen-fairness), unabhängig vom Generator-Code
 * gerechnet. Begriffe wie im Gherkin:
 * - „Spiel n“ = n-tes Spiel nach Zeitfenster, dann Feld (wie die Spielnummer im Spielplan).
 * - „zwischen zwei Spielen liegen x Spiele“ = Spielnummer-Abstand minus 1.
 * - „Doppel“ = zwei eigene Spiele in direkt aufeinanderfolgenden Zeitfenstern (gezählt über alle Teams).
 */
import type { Match, Team } from '../../../types/tournament';
import type { GroupPhaseScheduleOptions } from '../fairScheduler';
import { matchSideTeamId } from '../../models/matchSlot';
import { testUuid } from '../../../test/testIds';

export const SLOT_MIN = 10;
export const BREAK_MIN = 5;

/** DFB-Mindestabstand in Spielen je Teamzahl (@W4-031). */
export const DFB_MIN_GAMES_BETWEEN: Readonly<Record<number, number>> = {
  5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 4, 13: 5, 14: 5, 15: 6, 16: 6,
};

export function makeTeams(n: number, group: string, base: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: testUuid(base + i), name: `Team ${group}${i + 1}`, group, players: [] }));
}

/** Eine Gruppe heißt wie im Generator für „jeder gegen jeden“ (`all`), mehrere Gruppen A, B, … */
export function scenarioOptions(
  sizes: number[],
  fields: number,
  extra: Partial<GroupPhaseScheduleOptions> = {},
): GroupPhaseScheduleOptions {
  const groups = new Map<string, Team[]>();
  sizes.forEach((size, index) => {
    const label = sizes.length === 1 ? 'all' : String.fromCharCode(65 + index);
    groups.set(label, makeTeams(size, label, (index + 1) * 100));
  });
  return {
    groups,
    numberOfFields: fields,
    slotDurationMinutes: SLOT_MIN,
    breakBetweenSlotsMinutes: BREAK_MIN,
    minRestSlotsPerTeam: 1,
    startTime: new Date('2026-10-19T09:00:00'),
    ...extra,
  };
}

export function teamIdsOf(options: GroupPhaseScheduleOptions): string[] {
  return [...options.groups.values()].flat().map((t) => t.id);
}

export function ordered(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => (a.slot ?? a.round - 1) - (b.slot ?? b.round - 1) || a.field - b.field);
}

function sides(match: Match): [string, string] {
  const home = matchSideTeamId(match, 'A');
  const away = matchSideTeamId(match, 'B');
  if (home === undefined || away === undefined) { throw new Error('Gruppenspiel ohne Team'); }
  return [home, away];
}

export function homeOf(match: Match): string { return sides(match)[0]; }
export function awayOf(match: Match): string { return sides(match)[1]; }

/** Größter Unterschied gespielter Spiele und Spielnummern, nach denen alle gleich viele Spiele haben. */
export function playedTimeline(matches: Match[], teamIds: string[]): { maxDiff: number; equalAfter: number[] } {
  const played = new Map(teamIds.map((id) => [id, 0]));
  let maxDiff = 0;
  const equalAfter: number[] = [];
  ordered(matches).forEach((match, index) => {
    for (const id of sides(match)) { played.set(id, (played.get(id) ?? 0) + 1); }
    const counts = [...played.values()];
    const diff = Math.max(...counts) - Math.min(...counts);
    maxDiff = Math.max(maxDiff, diff);
    if (diff === 0) { equalAfter.push(index + 1); }
  });
  return { maxDiff, equalAfter };
}

/** Je Team die Zahl der Spiele zwischen zwei eigenen Spielen (nach Spielnummer). */
export function gamesBetweenByTeam(matches: Match[]): Map<string, number[]> {
  const numbers = new Map<string, number[]>();
  ordered(matches).forEach((match, index) => {
    for (const id of sides(match)) { numbers.set(id, [...(numbers.get(id) ?? []), index]); }
  });
  const result = new Map<string, number[]>();
  numbers.forEach((list, id) => result.set(id, list.slice(1).map((n, i) => n - list[i] - 1)));
  return result;
}

export function minGamesBetween(matches: Match[]): number {
  return Math.min(...[...gamesBetweenByTeam(matches).values()].flat());
}

export function longestPauseGames(matches: Match[]): number {
  return Math.max(...[...gamesBetweenByTeam(matches).values()].flat());
}

/** Stellen mit kürzerem Abstand als gefordert: Team + Spielnummer des späteren Spiels. */
export function shortGapSpots(matches: Match[], required: number): string[] {
  const spots: string[] = [];
  const last = new Map<string, number>();
  ordered(matches).forEach((match, index) => {
    for (const id of sides(match)) {
      const prev = last.get(id);
      if (prev !== undefined && index - prev - 1 < required) { spots.push(`${id}@${index + 1}`); }
      last.set(id, index);
    }
  });
  return spots.sort();
}

/** Längste Pause eines Teams in Minuten (Ende eines Spiels bis Beginn des nächsten, Zeitraster der Optionen). */
export function longestPauseMinutes(matches: Match[], slotMin = SLOT_MIN, breakMin = BREAK_MIN): number {
  const slots = new Map<string, number[]>();
  for (const match of matches) {
    for (const id of sides(match)) { slots.set(id, [...(slots.get(id) ?? []), match.slot ?? match.round - 1]); }
  }
  let longest = 0;
  slots.forEach((list) => {
    const sorted = [...list].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      longest = Math.max(longest, (sorted[i] - sorted[i - 1]) * (slotMin + breakMin) - slotMin);
    }
  });
  return longest;
}

export function slotCount(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, (m.slot ?? m.round - 1) + 1), 0);
}

/** Zahl der Spiele in direkt aufeinanderfolgenden Zeitfenstern (Paare, über alle Teams). */
export function consecutiveSlotDoubles(matches: Match[]): number {
  const slots = new Map<string, number[]>();
  for (const match of matches) {
    for (const id of sides(match)) { slots.set(id, [...(slots.get(id) ?? []), match.slot ?? match.round - 1]); }
  }
  let doubles = 0;
  slots.forEach((list) => {
    const sorted = [...list].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) { if (sorted[i] - sorted[i - 1] === 1) { doubles++; } }
  });
  return doubles;
}

/** Heimspiele je Team und längste Serie gleicher Seite. */
export function homeAwayStats(matches: Match[]): Map<string, { home: number; away: number; longestStreak: number }> {
  const history = new Map<string, string[]>();
  for (const match of ordered(matches)) {
    const [home, away] = sides(match);
    history.set(home, [...(history.get(home) ?? []), 'H']);
    history.set(away, [...(history.get(away) ?? []), 'G']);
  }
  const stats = new Map<string, { home: number; away: number; longestStreak: number }>();
  history.forEach((list, id) => {
    let run = 0;
    let longestStreak = 0;
    list.forEach((side, i) => { run = i > 0 && list[i - 1] === side ? run + 1 : 1; longestStreak = Math.max(longestStreak, run); });
    const home = list.filter((s) => s === 'H').length;
    stats.set(id, { home, away: list.length - home, longestStreak });
  });
  return stats;
}

/** Plan ohne Spiel-IDs (die neu erzeugt werden) als Vergleichsschlüssel. */
export function signature(matches: Match[]): string {
  return ordered(matches)
    .map((m) => `${m.slot}:${m.field}:${homeOf(m)}-${awayOf(m)}:${m.group}`)
    .join('|');
}

/** Spielnummern (1-basiert), in denen die beiden Teams gegeneinander spielen. */
export function matchNumberOf(matches: Match[], a: string, b: string): number {
  return ordered(matches).findIndex((m) => {
    const ids = sides(m);
    return ids.includes(a) && ids.includes(b);
  }) + 1;
}

/** Längste Pause eines Teams als Zahl der Zeitfenster zwischen zwei eigenen Spielen (auf einem Feld = Spiele). */
export function longestSlotsBetween(matches: Match[]): number {
  return (longestPauseMinutes(matches) + SLOT_MIN) / (SLOT_MIN + BREAK_MIN) - 1;
}

/** Kürzeste Pause eines Teams als Zahl der Zeitfenster zwischen zwei eigenen Spielen. */
export function minSlotsBetween(matches: Match[]): number {
  const slots = new Map<string, number[]>();
  for (const match of matches) {
    for (const id of sides(match)) { slots.set(id, [...(slots.get(id) ?? []), match.slot ?? match.round - 1]); }
  }
  let shortest = Number.POSITIVE_INFINITY;
  slots.forEach((list) => {
    const sorted = [...list].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) { shortest = Math.min(shortest, sorted[i] - sorted[i - 1] - 1); }
  });
  return shortest;
}
