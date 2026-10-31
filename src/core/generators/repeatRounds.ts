/**
 * Mehrere Runden bei „Jeder gegen jeden“ (@TM-152, @TM-153): Die Rundenzahl legt fest, wie oft jede Paarung gespielt
 * wird. Jede weitere Runde ist eine Kopie der Runde davor mit getauschtem Heim/Gast und folgt ihr vollständig
 * (Runde 1 vor Runde 2 …). Die Reihenfolge der Zeitfenster einer weiteren Runde wird so gewählt, dass die Mindestpause
 * auch über die Rundengrenze hält. Reines Modul ohne React.
 */
import type { Match, Tournament } from '../../types/tournament';
import { generateGroupStageMatchId } from '../../utils/idGenerator';
import { matchTeamIds } from '../models/matchSlot';

export const ROUND_COUNT_MIN = 1;
export const ROUND_COUNT_MAX = 10;

export type RoundCountHint = 'min' | 'max' | null;

/** Begrenzt eine Eingabe auf 1–10 (Tippfehler-Schutz, @TM-153) und meldet, welche Grenze gegriffen hat. */
export function clampRoundCount(value: number): { rounds: number; hint: RoundCountHint } {
  if (!Number.isFinite(value) || value < ROUND_COUNT_MIN) { return { rounds: ROUND_COUNT_MIN, hint: 'min' }; }
  if (value > ROUND_COUNT_MAX) { return { rounds: ROUND_COUNT_MAX, hint: 'max' }; }
  return { rounds: Math.floor(value), hint: null };
}

/**
 * Rundenzahl, mit der der Spielplan erzeugt wird: nur bei „Jeder gegen jeden“ (ohne Angabe gilt wie im Assistenten
 * „Jeder gegen jeden“), sonst 1 (@TM-140 später).
 */
export function effectiveRoundCount(tournament: Partial<Pick<Tournament, 'groupSystem' | 'numberOfRounds'>>): number {
  if ((tournament.groupSystem ?? 'roundRobin') !== 'roundRobin') { return 1; }
  return clampRoundCount(tournament.numberOfRounds ?? ROUND_COUNT_MIN).rounds;
}

export interface RepeatRoundsOptions {
  minRestSlots: number;
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  startTime?: Date;
}

const slotOf = (match: Match): number => match.slot ?? match.round - 1;

/** Kandidaten für die Reihenfolge der Zeitfenster: Drehungen vorwärts, dann rückwärts (erste = unverändert). */
function slotOrderCandidates(slotCount: number): number[][] {
  const forward = Array.from({ length: slotCount }, (_, i) => i);
  const backward = [...forward].reverse();
  const rotations = (order: number[]): number[][] =>
    order.map((_, shift) => [...order.slice(shift), ...order.slice(0, shift)]);
  return [...rotations(forward), ...rotations(backward)];
}

/** Zahl der Verstöße gegen die Mindestpause in einer Folge von Zeitfenstern (je Fenster die Teams). */
function restViolations(slots: readonly (readonly string[])[], minRestSlots: number): number {
  const last = new Map<string, number>();
  let violations = 0;
  slots.forEach((teams, index) => {
    for (const team of teams) {
      const previous = last.get(team);
      if (previous !== undefined && index - previous < minRestSlots + 1) { violations++; }
      last.set(team, index);
    }
  });
  return violations;
}

/** Kleinster Abstand in Zeitfenstern zwischen zwei Spielen desselben Teams (unendlich, wenn keiner zweimal spielt). */
function smallestGap(slots: readonly (readonly string[])[]): number {
  const last = new Map<string, number>();
  let gap = Number.POSITIVE_INFINITY;
  slots.forEach((teams, index) => teams.forEach((team) => {
    const previous = last.get(team);
    if (previous !== undefined) { gap = Math.min(gap, index - previous); }
    last.set(team, index);
  }));
  return gap;
}

/**
 * Rechenbudget je Suche nach einer Anordnung ohne Verstoß, in Suchschritten (jeder Versuch, ein Spiel in ein
 * Zeitfenster zu legen, zählt; nie in Zeit).
 */
export const ROUND_ORDER_NODE_BUDGET = 50_000;

type Slots = readonly (readonly Match[])[];

const teamsOfSlots = (slots: Slots): string[][] => slots.map((matches) => matches.flatMap((match) => matchTeamIds(match)));

/**
 * Rücksetzsuche: ordnet die Spiele der Runde davor neu in gleich viele, gleich große Zeitfenster hinter ihr an, ohne
 * Verstoß gegen die Mindestpause (innerhalb der Runde und über die Grenze). Bevorzugt Spiele, deren Teams am
 * längsten Pause haben. Null, wenn im Budget keine Anordnung gefunden.
 */
function searchArrangement(previous: Slots, minRestSlots: number, budget: number): Match[][] | null {
  const slotCount = previous.length;
  const matches = previous.flat();
  const teams = matches.map((match) => matchTeamIds(match));
  const last = new Map<string, number>();
  teamsOfSlots(previous).forEach((slotTeams, index) => slotTeams.forEach((team) => last.set(team, index)));
  const used = new Array<boolean>(matches.length).fill(false);
  const arrangement: Match[][] = [];
  let nodes = 0;

  const rested = (match: number, position: number): boolean =>
    teams[match].every((team) => position - (last.get(team) ?? Number.NEGATIVE_INFINITY) >= minRestSlots + 1);
  const remaining = new Map<string, number>();
  teams.flat().forEach((team) => remaining.set(team, (remaining.get(team) ?? 0) + 1));
  const waitOf = (match: number): number => Math.max(...teams[match].map((team) => last.get(team) ?? -1));
  const urgencyOf = (match: number): number => teams[match].reduce((sum, team) => sum + (remaining.get(team) ?? 0), 0);

  function fill(slot: number): boolean {
    if (slot === slotCount) { return true; }
    if (++nodes > budget) { return false; }
    const position = slotCount + slot;
    const size = previous[slot].length;
    const candidates = matches.map((_, index) => index)
      .filter((index) => !used[index] && rested(index, position))
      .sort((a, b) => urgencyOf(b) - urgencyOf(a) || waitOf(a) - waitOf(b) || a - b);
    const chosen: number[] = [];
    const busy = new Set<string>();

    function pick(from: number): boolean {
      if (++nodes > budget) { return false; }
      if (chosen.length === size) {
        const saved = chosen.flatMap((index) => teams[index].map((team) => [team, last.get(team)] as const));
        chosen.forEach((index) => {
          used[index] = true;
          teams[index].forEach((team) => { last.set(team, position); remaining.set(team, (remaining.get(team) ?? 1) - 1); });
        });
        arrangement.push(chosen.map((index) => matches[index]));
        if (fill(slot + 1)) { return true; }
        arrangement.pop();
        chosen.forEach((index) => {
          used[index] = false;
          teams[index].forEach((team) => remaining.set(team, (remaining.get(team) ?? 0) + 1));
        });
        saved.reverse().forEach(([team, value]) => { if (value === undefined) { last.delete(team); } else { last.set(team, value); } });
        return false;
      }
      for (let i = from; i < candidates.length && nodes <= budget; i++) {
        const index = candidates[i];
        if (teams[index].some((team) => busy.has(team))) { continue; }
        chosen.push(index); teams[index].forEach((team) => busy.add(team));
        if (pick(i + 1)) { return true; }
        chosen.pop(); teams[index].forEach((team) => busy.delete(team));
      }
      return false;
    }

    return pick(0);
  }

  return fill(0) ? arrangement : null;
}

/**
 * Anordnung der nächsten Runde: zuerst eine Drehung der Zeitfenster ohne zusätzlichen Verstoß (unverändert zuerst),
 * sonst die Rücksetzsuche mit der verlangten Pause, dann mit je einem Fenster weniger bis 0, zuletzt die Drehung mit
 * den wenigsten Verstößen.
 */
function arrangeNextRound(previous: Slots, minRestSlots: number): Match[][] {
  const previousTeams = teamsOfSlots(previous);
  const ownViolations = restViolations(previousTeams, minRestSlots);
  let best = slotOrderCandidates(previous.length)[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const order of slotOrderCandidates(previous.length)) {
    const score = restViolations([...previousTeams, ...order.map((index) => previousTeams[index])], minRestSlots);
    if (score < bestScore) { best = order; bestScore = score; }
    if (score === 2 * ownViolations) { break; }
  }
  const rotated = best.map((index) => [...previous[index]]);
  if (bestScore === 2 * ownViolations) { return rotated; }
  for (let rest = minRestSlots; rest >= 0; rest--) {
    const found = searchArrangement(previous, rest, ROUND_ORDER_NODE_BUDGET);
    if (found) { return found; }
  }
  return rotated;
}

/**
 * Hängt an die Spiele der ersten Runde die Runden 2 … `rounds` an. Runde k enthält die Spiele der Runde k−1 mit
 * getauschtem Heim/Gast; ihre Zeitfenster liegen hinter der Runde k−1, Feld je Fenster wie in der Runde davor.
 */
export function repeatRounds(firstRound: readonly Match[], rounds: number, options: RepeatRoundsOptions): Match[] {
  if (rounds <= 1 || firstRound.length === 0) { return [...firstRound]; }
  const step = (options.slotDurationMinutes + options.breakBetweenSlotsMinutes) * 60_000;
  const timeOf = (slot: number): Date | undefined =>
    options.startTime ? new Date(options.startTime.getTime() + slot * step) : undefined;

  // Runde 1 auf belegte Zeitfenster verdichten (so plant auch die Zeitplanung, leere Fenster entfallen dort).
  const occupied = [...new Set(firstRound.map(slotOf))].sort((a, b) => a - b);
  const bySlot: Match[][] = occupied.map((slot, position) => firstRound
    .filter((match) => slotOf(match) === slot)
    .sort((a, b) => a.field - b.field)
    .map((match) => ({ ...match, slot: position, round: position + 1, scheduledTime: timeOf(position) })));
  const slotCount = bySlot.length;

  // Schafft schon die erste Runde die Mindestpause nicht, gilt über die Grenze das, was sie schafft (nie schlechter).
  const restSlots = Math.min(options.minRestSlots, smallestGap(teamsOfSlots(bySlot)) - 1);

  const result: Match[] = bySlot.flat();
  let previous: Match[][] = bySlot;
  for (let round = 1; round < rounds; round++) {
    const arranged = arrangeNextRound(previous, restSlots);
    const next = arranged.map((matches, position) => {
      const slot = round * slotCount + position;
      const fields = (previous[position].length === matches.length ? previous[position] : matches).map((match) => match.field);
      return matches.map((match, index): Match => ({
        ...match,
        id: generateGroupStageMatchId(),
        slotA: match.slotB,
        slotB: match.slotA,
        field: fields[index] ?? match.field,
        slot,
        round: slot + 1,
        scheduledTime: timeOf(slot),
      }));
    });
    next.forEach((matches) => result.push(...matches));
    previous = next;
  }
  return result;
}
