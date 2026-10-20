/**
 * Suche der Spielfolge für den Runden-Spielplan auf einem Feld (@W4-029, @W4-031, @W4-036, @W4-038).
 *
 * Gegeben sind Runden (je Runde spielt jedes Team höchstens einmal). Gesucht ist die Reihenfolge der Runden und
 * der Spiele in jeder Runde. Tiefensuche mit Schranke (Branch-and-Bound) nach dem Spike-Prototyp:
 * - hart: mindestens `minPause` Spiele zwischen zwei Spielen eines Teams;
 * - hart (Positionsregel): zwischen zwei aufeinanderfolgenden Runden springt ein Team um höchstens einen Platz,
 *   die Pause liegt also bei k−2 … k Spielen (k = Spiele je Runde), nach einem Freilos bis 2k;
 * - Ziel: Summe der quadrierten Abweichungen der Pausen vom Ideal (n−2)/2, dann kürzeste Wartezeit am Ende,
 *   dann am Anfang. Gleichstand: zuerst gefundene Folge (feste Suchreihenfolge).
 *
 * Das Rechenbudget zählt Suchschritte (Knoten), nie Zeit: gleiche Eingabe → gleicher Plan auf jedem Gerät.
 * Gerechnet wird ganzzahlig (Kosten mit Faktor 4), damit keine Rundungsfrage über die Auswahl entscheidet.
 */

/** Paarung aus zwei Team-Indizes (0-basiert). */
export type TeamPair = readonly [number, number];

export interface RoundOrderSearchInput {
  teamCount: number;
  rounds: readonly (readonly TeamPair[])[];
  /** Mindestzahl Spiele zwischen zwei Spielen desselben Teams. */
  minPause: number;
  /** Höchstzahl Suchschritte. */
  nodeBudget: number;
  /** Erste Runde fest (Runde 0): bei einer Gruppe nach der Kreismethode gleichwertig, spart Faktor „Rundenzahl“. */
  fixFirstRound: boolean;
}

export interface RoundOrderSearchResult {
  /** Beste gefundene Spielfolge oder null, wenn im Budget keine gültige Folge gefunden wurde. */
  sequence: TeamPair[] | null;
  /** Position der Runde (0-basiert, in Spielfolge) je Spiel der Folge. */
  roundPositions: number[];
  nodes: number;
  /** true = Suche vollständig (bestes Ergebnis bewiesen bzw. Unlösbarkeit bewiesen). */
  complete: boolean;
}

type Score = readonly [number, number, number];

interface BestOrder {
  score: Score;
  sequence: TeamPair[];
  positions: number[];
}

function isBetterScore(a: Score, b: Score | null): boolean {
  if (b === null) { return true; }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { return a[i] < b[i]; }
  }
  return false;
}

export function searchRoundOrder(input: RoundOrderSearchInput): RoundOrderSearchResult {
  const { teamCount, rounds, minPause, nodeBudget, fixFirstRound } = input;
  const perRound = Math.max(0, ...rounds.map((round) => round.length));
  const totalMatches = rounds.reduce((sum, round) => sum + round.length, 0);
  const twiceIdeal = teamCount - 2; // 2 × ideale Pause (n−2)/2
  const lastIndex = new Array<number>(teamCount).fill(-1);
  const lastRound = new Array<number>(teamCount).fill(-1);
  const usedRound = new Array<boolean>(rounds.length).fill(false);
  const sequence: TeamPair[] = [];
  const positions: number[] = [];
  const found: { best: BestOrder | null } = { best: null };
  let nodes = 0;
  let aborted = false;

  /** Kosten (×4) der Pause vor dem Spiel an Stelle `index`, oder null, wenn eine harte Regel verletzt ist. */
  function pauseCost(team: number, index: number, roundPos: number): number | null {
    const previous = lastIndex[team];
    if (previous < 0) { return 0; }
    const pause = index - previous - 1;
    if (pause < minPause) { return null; }
    const roundGap = roundPos - lastRound[team];
    const high = roundGap === 1 ? perRound : 2 * perRound;
    const low = roundGap === 1 ? Math.max(minPause, perRound - 2) : minPause;
    if (pause < low || pause > high) { return null; }
    const deviation = 2 * pause - twiceIdeal;
    return deviation * deviation;
  }

  function recordLeaf(cost: number): void {
    let endWait = 0;
    let startWait = 0;
    const first = new Array<number>(teamCount).fill(-1);
    sequence.forEach((pair, index) => { for (const team of pair) { if (first[team] < 0) { first[team] = index; } } });
    for (let team = 0; team < teamCount; team++) {
      if (lastIndex[team] >= 0) { endWait = Math.max(endWait, totalMatches - 1 - lastIndex[team]); }
      startWait = Math.max(startWait, first[team]);
    }
    const score: Score = [cost, endWait, startWait];
    if (isBetterScore(score, found.best?.score ?? null)) {
      found.best = { score, sequence: [...sequence], positions: [...positions] };
    }
  }

  function startRound(roundPos: number, cost: number): void {
    if (sequence.length === totalMatches) { recordLeaf(cost); return; }
    for (let r = 0; r < rounds.length; r++) {
      if (usedRound[r] || (fixFirstRound && roundPos === 0 && r !== 0)) { continue; }
      usedRound[r] = true;
      placeInRound(roundPos, [...rounds[r]], cost);
      usedRound[r] = false;
      if (aborted) { return; }
    }
  }

  function placeInRound(roundPos: number, remaining: TeamPair[], cost: number): void {
    nodes++;
    if (nodes > nodeBudget) { aborted = true; return; }
    if (found.best !== null && cost > found.best.score[0]) { return; }
    if (remaining.length === 0) { startRound(roundPos + 1, cost); return; }
    const index = sequence.length;
    for (let i = 0; i < remaining.length; i++) {
      const pair = remaining[i];
      const costA = pauseCost(pair[0], index, roundPos);
      if (costA === null) { continue; }
      const costB = pauseCost(pair[1], index, roundPos);
      if (costB === null) { continue; }
      const saved = [lastIndex[pair[0]], lastIndex[pair[1]], lastRound[pair[0]], lastRound[pair[1]]];
      lastIndex[pair[0]] = index; lastIndex[pair[1]] = index;
      lastRound[pair[0]] = roundPos; lastRound[pair[1]] = roundPos;
      sequence.push(pair); positions.push(roundPos);
      placeInRound(roundPos, remaining.filter((_, j) => j !== i), cost + costA + costB);
      sequence.pop(); positions.pop();
      [lastIndex[pair[0]], lastIndex[pair[1]], lastRound[pair[0]], lastRound[pair[1]]] = saved;
      if (aborted) { return; }
    }
  }

  startRound(0, 0);
  return {
    sequence: found.best ? found.best.sequence : null,
    roundPositions: found.best ? found.best.positions : [],
    nodes: Math.min(nodes, nodeBudget),
    complete: !aborted,
  };
}
