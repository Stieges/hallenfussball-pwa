/**
 * Runden-Spielplan „jeder gegen jeden“ auf einem Feld (@W4-029 … @W4-031, @W4-036 … @W4-039).
 *
 * Paarungen je Runde nach der Kreismethode (wie `generateRoundRobinPairings`), bei mehreren Gruppen werden die
 * Runden zusammengelegt (@W4-038). Reihenfolge per `searchRoundOrder`, Heim/Gast per `assignHomeAway`.
 * Bei einer Gruppe mit 5–16 Teams wird zuerst ein Plan mit DFB-Mindestabstand gesucht (@W4-031); findet die
 * Suche im Budget keinen, folgt ein Plan mit der eingestellten Mindestpause (@W4-039, Meldung in der Auswahl).
 * Reines Modul ohne React; Rechenbudget in Suchschritten, nie in Zeit.
 */
import type { Match } from '../../types/tournament';
import { generateGroupStageMatchId } from '../../utils/idGenerator';
import { teamSlot } from '../models/matchSlot';
import { assignHomeAway } from './roundRobinHomeAway';
import { searchRoundOrder, type TeamPair } from './roundRobinSearch';

/** Mindestzahl Spiele zwischen zwei Spielen eines Teams im DFB-Schlüssel (1 Feld, eine Gruppe), @W4-031. */
export const DFB_MIN_GAMES_BETWEEN: Readonly<Record<number, number>> = {
  5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 4, 12: 4, 13: 5, 14: 5, 15: 6, 16: 6,
};

/** Kleinste Gruppengröße, ab der der Rundenplan vorgeschlagen wird (3 und 4 Teams haben keine Lösung). */
export const MIN_TEAMS_FOR_ROUNDS = 5;

/**
 * Rechenbudget je Suchlauf in Suchschritten (Knoten). Gemessen 2026-10-19 (Report task-runden-spielplan):
 * bis 12 Teams vollständige Suche, darüber bestes Ergebnis im Budget.
 */
export const ROUNDS_NODE_BUDGET = 400_000;

export interface RoundsGroup {
  groupId: string;
  teamIds: readonly string[];
}

export interface RoundsPlanMatch {
  home: string;
  away: string;
  groupId: string;
  /** Position der Runde in der Spielfolge (0 = erste Runde). */
  roundPosition: number;
}

export interface RoundsPlan {
  matches: RoundsPlanMatch[];
  /** Geforderter DFB-Abstand (nur eine Gruppe, 5–16 Teams), sonst null. */
  dfbTarget: number | null;
  nodes: number;
  complete: boolean;
}

export function dfbMinGamesBetween(groupSizes: readonly number[]): number | null {
  return groupSizes.length === 1 ? DFB_MIN_GAMES_BETWEEN[groupSizes[0]] ?? null : null;
}

/** Rundenplan kommt in Frage: ein Feld, kein DFB-Schlüssel, jede Gruppe ab 5 Teams. */
export function isRoundsPlanEligible(groupSizes: readonly number[], numberOfFields: number, dfbPatternCode?: string): boolean {
  return numberOfFields === 1 && !dfbPatternCode && groupSizes.length > 0
    && groupSizes.every((size) => size >= MIN_TEAMS_FOR_ROUNDS);
}

/** Kreismethode: n−1 Runden (gerade n) bzw. n Runden mit Freilos (ungerade n), Team-Indizes 0 … n−1. */
export function circleRounds(teamCount: number): TeamPair[][] {
  const size = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const ring = Array.from({ length: size }, (_, i) => i);
  const rounds: TeamPair[][] = [];
  for (let r = 0; r < size - 1; r++) {
    const round: TeamPair[] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = ring[i];
      const b = ring[size - 1 - i];
      if (a < teamCount && b < teamCount) { round.push([a, b]); }
    }
    rounds.push(round);
    const last = ring[size - 1];
    for (let i = size - 1; i > 1; i--) { ring[i] = ring[i - 1]; }
    ring[1] = last;
  }
  return rounds;
}

function mergedRounds(groups: readonly RoundsGroup[]): TeamPair[][] {
  let offset = 0;
  const perGroup = groups.map((group) => {
    const rounds = circleRounds(group.teamIds.length)
      .map((round) => round.map(([a, b]) => [a + offset, b + offset] as TeamPair));
    offset += group.teamIds.length;
    return rounds;
  });
  const roundCount = Math.max(...perGroup.map((rounds) => rounds.length));
  return Array.from({ length: roundCount }, (_, r) => perGroup.flatMap((rounds) => rounds[r] ?? []));
}

/** Rückfall ohne Serienregel: Heim ist, wer bisher seltener Heim war. */
function balancedHomeAway(sequence: readonly TeamPair[], teamCount: number): TeamPair[] {
  const saldo = new Array<number>(teamCount).fill(0);
  return sequence.map(([a, b]) => {
    const pair: TeamPair = saldo[b] < saldo[a] ? [b, a] : [a, b];
    saldo[pair[0]]++; saldo[pair[1]]--;
    return pair;
  });
}

/**
 * Sucht den Rundenplan. Null, wenn die Mindestpause im Budget keinen Plan zulässt (dann bleibt der heutige Plan).
 */
export function planRounds(groups: readonly RoundsGroup[], minRestSlots: number, nodeBudget = ROUNDS_NODE_BUDGET): RoundsPlan | null {
  const teamIds = groups.flatMap((group) => [...group.teamIds]);
  const groupOfIndex = groups.flatMap((group) => group.teamIds.map(() => group.groupId));
  const gamesPerTeam = groups.flatMap((group) => group.teamIds.map(() => group.teamIds.length - 1));
  const rounds = mergedRounds(groups);
  const dfbTarget = dfbMinGamesBetween(groups.map((group) => group.teamIds.length));
  const search = (minPause: number): ReturnType<typeof searchRoundOrder> => searchRoundOrder({
    teamCount: teamIds.length, rounds, minPause, nodeBudget, fixFirstRound: groups.length === 1,
  });

  let result = search(Math.max(minRestSlots, dfbTarget ?? 0));
  let nodes = result.nodes;
  if (result.sequence === null && dfbTarget !== null && dfbTarget > minRestSlots) {
    result = search(minRestSlots);
    nodes += result.nodes;
  }
  const sequence = result.sequence;
  if (sequence === null) { return null; }

  const oriented = assignHomeAway(sequence, gamesPerTeam) ?? balancedHomeAway(sequence, teamIds.length);
  return {
    matches: oriented.map(([home, away], index) => ({
      home: teamIds[home],
      away: teamIds[away],
      groupId: groupOfIndex[home],
      roundPosition: result.roundPositions[index],
    })),
    dfbTarget,
    nodes,
    complete: result.complete,
  };
}

export interface RoundsTiming {
  slotDurationMinutes: number;
  breakBetweenSlotsMinutes: number;
  startTime?: Date;
}

/** Spiele im Format des Gruppengenerators (Feld 1, ein Spiel je Zeitfenster). */
export function roundsPlanToMatches(plan: RoundsPlan, timing: RoundsTiming): Match[] {
  const step = (timing.slotDurationMinutes + timing.breakBetweenSlotsMinutes) * 60_000;
  return plan.matches.map((entry, slot) => ({
    id: generateGroupStageMatchId(),
    round: slot + 1,
    field: 1,
    slot,
    slotA: teamSlot(entry.home),
    slotB: teamSlot(entry.away),
    group: entry.groupId,
    scheduledTime: timing.startTime ? new Date(timing.startTime.getTime() + slot * step) : undefined,
  }));
}
