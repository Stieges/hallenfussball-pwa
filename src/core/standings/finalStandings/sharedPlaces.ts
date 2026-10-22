/**
 * Platzziffern im Endstand (A-19a, R-EA-4, Review W4): Platz = 1 + Zahl der Teams davor; Teams, die sich einen Platz teilen,
 * tragen die Ziffer des ersten, danach geht es so viele Plätze später weiter, wie Teams den Platz teilen (2, 2, 2, 5).
 * Dieselbe Regel prüft der Server beim Turnierabschluss (Gleichlauf `final-standings-roundrobin.json`). Rein, ohne React.
 */

/**
 * Platzziffern für eine Reihenfolge. `sharedBlocks` sind Teams, die sich einen Platz teilen; ein Block zählt nur, wenn
 * seine Teams in `order` unmittelbar hintereinander stehen – sonst `undefined` (Reihenfolge und Blöcke passen nicht).
 */
export function placeNumbers(order: readonly string[], sharedBlocks: ReadonlyArray<readonly string[]>): number[] | undefined {
  const blockOf = new Map<string, number>();
  sharedBlocks.forEach((block, index) => block.forEach((teamId) => blockOf.set(teamId, index)));
  const places: number[] = [];
  for (let i = 0; i < order.length; i++) {
    const block = blockOf.get(order[i]);
    const withPrevious = block !== undefined && i > 0 && blockOf.get(order[i - 1]) === block;
    places.push(withPrevious ? places[i - 1] : i + 1);
  }
  for (const block of sharedBlocks) {
    const positions = order.map((teamId, i) => (block.includes(teamId) ? i : -1)).filter((i) => i >= 0);
    const contiguous = positions.length === block.length && positions.every((p, k) => p === positions[0] + k);
    if (!contiguous) {
      return undefined;
    }
  }
  return places;
}

/** Folgen die Platzziffern der Regel? Erster Platz 1; jede weitere Ziffer = vorige (geteilt) oder Position + 1 (Sprung). */
export function placeNumbersValid(places: readonly number[]): boolean {
  return places.every((place, i) => (i === 0 ? place === 1 : place === places[i - 1] || place === i + 1));
}
