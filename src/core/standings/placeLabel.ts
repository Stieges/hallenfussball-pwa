/**
 * Platzziffer einer Tabellenzeile für jede Anzeige (@ZM-198): Vor dem ersten gespielten Spiel der Tabelle steht bei allen Teams „–“
 * statt „1“ (die Reihenfolge bleibt die der Teilnehmerliste); danach die gemeinsame Platzziffer (`place`, @W2A-047) oder die Zeilennummer.
 * Eine Logik für Monitor-Tabelle und Tabelle der Zuschauer-Seite; reine Funktion, kein React.
 */

/** Kein Team der Tabelle hat gespielt: es gibt noch keine Rangfolge. */
export function standingsHaveNoPlaces(rows: ReadonlyArray<{ played: number }>): boolean {
  return rows.every((row) => row.played === 0);
}

/** Text der Platzspalte: „–“ ohne Rangfolge, sonst Platzziffer oder Zeilennummer (`index` zählt ab 0). */
export function placeLabel(rows: ReadonlyArray<{ played: number; place?: number }>, index: number): string {
  if (standingsHaveNoPlaces(rows)) { return '–'; }
  return String(rows[index]?.place ?? index + 1);
}
