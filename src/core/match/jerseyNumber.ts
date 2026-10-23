/**
 * Rückennummer (@SL-172): eine ganze Zahl von 1 bis 99. Eine EINZIGE Grenze für Eingabe (NumberPicker, Bearbeiten-Dialog)
 * und Torschützenliste (Altdaten außerhalb zählen als „ohne Nummer“, H5 aus Review #332). Rein, ohne React.
 */
export const JERSEY_NUMBER_MIN = 1;
export const JERSEY_NUMBER_MAX = 99;

/** Ist der Wert eine gültige Rückennummer (ganze Zahl 1–99)? */
export function isJerseyNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= JERSEY_NUMBER_MIN && value <= JERSEY_NUMBER_MAX;
}

/**
 * Eingabetext → Nummer. `null` = leer (keine Nummer angegeben, kein Fehler), `'ungueltig'` = abweisen mit Hinweis
 * (0, 100, „7a“, „1e1“, „-3“, „4.5“). Nur Ziffern zählen.
 */
export function parseJerseyNumberInput(text: string): number | null | 'ungueltig' {
  const trimmed = text.trim();
  if (trimmed === '') { return null; }
  if (!/^\d{1,3}$/.test(trimmed)) { return 'ungueltig'; }
  const value = Number(trimmed);
  return isJerseyNumber(value) ? value : 'ungueltig';
}
