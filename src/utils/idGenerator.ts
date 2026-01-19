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
export function generateUniqueId(): string {
  // Use crypto.randomUUID for collision-free IDs (essential for sync)
  // Fallback for older browsers included
   
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random (simulated UUID-ish)
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substring(2);
  const count = (counter++).toString(16);
  return `${timestamp}-${random}-${count}`.padEnd(36, '0').substring(0, 36); // weak fallback but consistent format
}

/**
 * Generiert eine Match-ID
 * @returns UUID
 */
export function generateGroupStageMatchId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Match-ID
 * @returns UUID
 */
export function generateFinalsMatchId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Tournament-ID
 * @returns UUID
 */
export function generateTournamentId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Team-ID
 * @returns UUID (kompatibel mit Supabase)
 */
export function generateTeamId(): string {
  return generateUniqueId();
}

/**
 * Reset counter (nur für Tests)
 */
export function resetCounter(): void {
  counter = 0;
}
