/**
 * ID Generator für garantiert eindeutige IDs
 *
 * Generiert IDs im Format: {prefix}-{timestamp}-{random}-{counter}
 * - prefix: Namespace (z.B. 'gs' für Gruppenphase, 'fr' für Finalrunde)
 * - timestamp: Millisekunden seit Epoch
 * - random: Zufälliger 6-stelliger String (Base36)
 * - counter: Fortlaufender Zähler
 */

let counter = 0;

/**
 * Generiert eine eindeutige ID
 * @param prefix Optional: Namespace-Präfix (default: 'match')
 * @returns Eindeutige ID im Format prefix-timestamp-random-counter
 */
export function generateUniqueId(prefix: string = 'match'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8); // 6 Zeichen
  const count = counter++;

  return `${prefix}-${timestamp}-${random}-${count}`;
}

/**
 * Generiert eine Match-ID für Gruppenphase
 * @returns Eindeutige Match-ID mit 'gs'-Präfix
 */
export function generateGroupStageMatchId(): string {
  return generateUniqueId('gs');
}

/**
 * Generiert eine Match-ID für Finalrunden
 * @returns Eindeutige Match-ID mit 'fr'-Präfix
 */
export function generateFinalsMatchId(): string {
  return generateUniqueId('fr');
}

/**
 * Generiert eine Tournament-ID
 * @returns Eindeutige Tournament-ID mit 't'-Präfix
 */
export function generateTournamentId(): string {
  return generateUniqueId('t');
}

/**
 * Reset counter (nur für Tests)
 */
export function resetCounter(): void {
  counter = 0;
}
