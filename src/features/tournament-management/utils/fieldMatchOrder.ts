/**
 * Spiele eines Felds für die Spielauswahl im Cockpit (C-SPIELNUMMER-FEHLT, @SL-049): in der Reihenfolge, in der sie
 * auf dem Feld gespielt werden (Platz im Raster), bei gleichem Platz nach Spielnummer – nie nach dem Listenplatz.
 */
interface FieldMatch {
  field: number;
  slot?: number;
  matchNumber: number;
}

export function matchesOfFieldInPlayOrder<T extends FieldMatch>(matches: readonly T[], field: number): T[] {
  return matches
    .filter((m) => m.field === field)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.matchNumber - b.matchNumber);
}
