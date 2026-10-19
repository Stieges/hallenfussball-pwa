/**
 * Heim/Gast im Runden-Spielplan (@W4-030, @W4-036, @W4-038): je Team höchstens ⌈Spiele/2⌉ Heim- und
 * Gastspiele (bei 5 Spielen also 2 oder 3 Heimspiele, bei 4 genau 2) und nie dreimal hintereinander dieselbe Seite.
 * Rücksetzsuche in fester Reihenfolge (deterministisch), begrenzt in Suchschritten.
 */
import type { TeamPair } from './roundRobinSearch';

export const HOME_AWAY_STEP_BUDGET = 200_000;
const MAX_SAME_SIDE_IN_ROW = 2;

/**
 * Ordnet jede Paarung als [Heim, Gast]. `gamesPerTeam[t]` = Zahl der Spiele von Team t.
 * Gibt null zurück, wenn im Budget keine Zuordnung gefunden wurde.
 */
export function assignHomeAway(
  sequence: readonly TeamPair[],
  gamesPerTeam: readonly number[],
  stepBudget = HOME_AWAY_STEP_BUDGET,
): TeamPair[] | null {
  const teamCount = gamesPerTeam.length;
  const limit = gamesPerTeam.map((games) => Math.ceil(games / 2));
  const home = new Array<number>(teamCount).fill(0);
  const away = new Array<number>(teamCount).fill(0);
  const sides: boolean[][] = Array.from({ length: teamCount }, () => []); // true = Heim
  const result: TeamPair[] = [];
  let steps = 0;

  const wouldRepeat = (team: number, isHome: boolean): boolean => {
    const history = sides[team];
    if (history.length < MAX_SAME_SIDE_IN_ROW) { return false; }
    return history.slice(-MAX_SAME_SIDE_IN_ROW).every((side) => side === isHome);
  };

  function place(index: number): boolean {
    if (index === sequence.length) { return true; }
    if (++steps > stepBudget) { return false; }
    const [a, b] = sequence[index];
    // Bevorzugt Heim: wer bisher seltener Heim war (Saldo Heim − Gast), bei Gleichstand die erstgenannte Seite.
    const options: TeamPair[] = home[b] - away[b] < home[a] - away[a] ? [[b, a], [a, b]] : [[a, b], [b, a]];
    for (const [h, g] of options) {
      if (home[h] >= limit[h] || away[g] >= limit[g]) { continue; }
      if (wouldRepeat(h, true) || wouldRepeat(g, false)) { continue; }
      home[h]++; away[g]++; sides[h].push(true); sides[g].push(false); result.push([h, g]);
      if (place(index + 1)) { return true; }
      home[h]--; away[g]--; sides[h].pop(); sides[g].pop(); result.pop();
      if (steps > stepBudget) { return false; }
    }
    return false;
  }

  return place(0) ? result : null;
}
