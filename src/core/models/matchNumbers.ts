/**
 * Spielnummer eines Spiels: stabil, eindeutig, in Spielplan-Reihenfolge
 * (Befunde C-SPIELNUMMER-FEHLT, C-FINALRUNDE-REIHENFOLGE; @SL-049, @ZM-007, @TM-142).
 *
 * Die Nummer entsteht beim Erzeugen des Spielplans (`scheduleMatches`: Zeitfenster, dann Feld) und wird mit dem
 * Spiel gespeichert (lokal `matchNumber`, Cloud `matches.match_number`). Danach bleibt sie, auch wenn ein Spiel
 * verschoben wird.
 *
 * Rückfallregel, wenn sie fehlt (Altdaten: `match_number` NULL) oder nicht eindeutig ist (zwei „Spiel 7“): Alle
 * Spiele werden neu in Spielplan-Reihenfolge gezählt – Anstoßzeit, dann Platz im Raster (Slot), dann Feld. Eine
 * Teil-Ergänzung (nur fehlende Nummern hinten anhängen) wäre eindeutig, aber nicht in Spielplan-Reihenfolge; da
 * der Fehlerfall nur Altdaten betrifft, gilt die ganze Neuzählung. Die ID entscheidet nur, wenn zwei Spiele zur
 * selben Zeit auf demselben Feld liegen (ungültiger Plan) – damit die Zählung auf jedem Gerät gleich ist.
 */

/** Was die Zählung von einem Spiel braucht (Domain-`Match` und Generator-Spiele erfüllen es). */
export interface NumberableMatch {
  id: string;
  field: number;
  round: number;
  slot?: number;
  scheduledTime?: Date | string;
  matchNumber?: number;
}

const kickoffMs = (match: NumberableMatch): number => {
  const ms = match.scheduledTime === undefined ? Number.NaN : new Date(match.scheduledTime).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

const gridSlot = (match: NumberableMatch): number => match.slot ?? match.round - 1;

/** Spielplan-Reihenfolge: Anstoßzeit (ohne Zeit zuletzt), Slot, Feld, zuletzt die ID. */
export function compareInScheduleOrder(a: NumberableMatch, b: NumberableMatch): number {
  const byTime = kickoffMs(a) - kickoffMs(b);
  if (byTime !== 0 && !Number.isNaN(byTime)) {
    return byTime;
  }
  return gridSlot(a) - gridSlot(b) || a.field - b.field || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Trägt jedes Spiel eine eigene ganze Nummer ab 1? */
export function hasCompleteMatchNumbers(matches: readonly NumberableMatch[]): boolean {
  const seen = new Set<number>();
  for (const { matchNumber } of matches) {
    if (matchNumber === undefined || !Number.isInteger(matchNumber) || matchNumber < 1 || seen.has(matchNumber)) {
      return false;
    }
    seen.add(matchNumber);
  }
  return true;
}

/**
 * Gibt die Spiele mit Spielnummer zurück, in derselben Reihenfolge wie übergeben. Vollständige, eindeutige
 * Nummern bleiben unverändert (dasselbe Array); sonst gilt die Rückfallregel (siehe Kopf).
 */
export function ensureMatchNumbers<T extends NumberableMatch>(matches: readonly T[]): T[] {
  if (hasCompleteMatchNumbers(matches)) {
    return matches as T[];
  }
  const numberById = new Map(
    [...matches].sort(compareInScheduleOrder).map((match, index) => [match.id, index + 1] as const)
  );
  return matches.map((match) => ({ ...match, matchNumber: numberById.get(match.id) ?? match.matchNumber }));
}

/** Spiele nach Spielnummer aufsteigend (neues Array); Spiele ohne Nummer zuletzt. */
export function sortByMatchNumber<T extends Pick<NumberableMatch, 'matchNumber'>>(matches: readonly T[]): T[] {
  const key = (match: T): number => match.matchNumber ?? Number.POSITIVE_INFINITY;
  return [...matches].sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? -1 : 1));
}
