/**
 * Spiele eines Felds für die Spielauswahl im Cockpit (C-SPIELNUMMER-FEHLT, @SL-049): in der Reihenfolge, in der sie
 * auf dem Feld gespielt werden – wie `compareInScheduleOrder`: Anstoßzeit, dann Platz im Raster (Slot), dann
 * Spielnummer; nie nach dem Listenplatz. Der Spielplan-Editor ändert beim Verschieben nur die Anstoßzeit, nicht den
 * Slot – deshalb zählt die Anstoßzeit zuerst; die Nummer des verschobenen Spiels bleibt.
 */
interface FieldMatch {
  field: number;
  slot?: number;
  matchNumber: number;
  startTime?: Date;
}

const kickoffMs = (match: FieldMatch): number => {
  const ms = match.startTime?.getTime() ?? Number.NaN;
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

function compareInPlayOrder(a: FieldMatch, b: FieldMatch): number {
  const byTime = kickoffMs(a) - kickoffMs(b);
  if (byTime !== 0 && !Number.isNaN(byTime)) {
    return byTime;
  }
  return (a.slot ?? 0) - (b.slot ?? 0) || a.matchNumber - b.matchNumber;
}

export function matchesOfFieldInPlayOrder<T extends FieldMatch>(matches: readonly T[], field: number): T[] {
  return matches.filter((m) => m.field === field).sort(compareInPlayOrder);
}
