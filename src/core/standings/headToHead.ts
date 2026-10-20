/**
 * Direkter Vergleich als Sondertabelle (BFV Teil 3 § 20 (13); @W2A-002, @W2A-045): nur die Spiele zwischen den Teams
 * des Blocks, Punkte nach dem eingestellten Punkteschema, dann Tordifferenz, dann Tore. Bei zwei Teams ist das genau
 * das Ergebnis ihres Spiels (bzw. ihrer Spiele). Rein, ohne React.
 */
import type { Match, PointSystem } from '../../types/tournament';
import { matchOutcome } from './countsForStandings';

export interface MiniTableRow {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

/** Sondertabelle über den Block: je Team Punkte und Tore nur aus Spielen gegen andere Teams des Blocks. */
export function miniTable(
  block: readonly string[],
  matches: readonly Match[],
  pointSystem: PointSystem,
): Map<string, MiniTableRow> {
  const members = new Set(block);
  const rows = new Map<string, MiniTableRow>(block.map((teamId) => [teamId, { points: 0, goalsFor: 0, goalsAgainst: 0 }]));
  for (const match of matches) {
    const outcome = matchOutcome(match, pointSystem);
    if (outcome === null || !members.has(outcome[0].teamId) || !members.has(outcome[1].teamId)) {
      continue;
    }
    for (const sideOutcome of outcome) {
      const row = rows.get(sideOutcome.teamId);
      if (row !== undefined) {
        row.points += sideOutcome.points;
        row.goalsFor += sideOutcome.goalsFor;
        row.goalsAgainst += sideOutcome.goalsAgainst;
      }
    }
  }
  return rows;
}

/** Schlüssel der Sondertabelle je Team (größer = besser): Punkte, Tordifferenz, Tore. */
export function miniTableKey(row: MiniTableRow | undefined): number[] {
  if (row === undefined) {
    return [0, 0, 0];
  }
  return [row.points, row.goalsFor - row.goalsAgainst, row.goalsFor];
}
