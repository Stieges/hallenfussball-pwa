/**
 * Cryptographically secure UUID v4 generator.
 *
 * Replaces a previous Math.random()-based fallback that was not CSPRNG-safe.
 * IDs produced here are used as primary keys for tournaments, teams, matches
 * and mutation-queue entries; collisions across devices would corrupt sync.
 */

/**
 * Generiert eine kryptographisch sichere UUID v4.
 *
 * Browser-Kompatibilität (Stand 2026):
 *   - Bevorzugt: crypto.randomUUID()      → Chrome 92+, Firefox 95+, Safari 15.4+, Node 14.17+
 *   - Fallback:  crypto.getRandomValues() → IE11+, alle modernen Browser, Node 16+
 *   - Wenn keines verfügbar: throw (kein schwacher Math.random()-Fallback)
 *
 * @returns RFC 4122 v4 UUID, z.B. "550e8400-e29b-41d4-a716-446655440000"
 * @throws Error wenn weder crypto.randomUUID noch crypto.getRandomValues verfügbar
 */
export function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // RFC 4122 v4: 128 random bits with version+variant bits set per spec.
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  throw new Error(
    'Cryptographically secure UUID generation unavailable: ' +
      'neither crypto.randomUUID nor crypto.getRandomValues is supported. ' +
      'Update your runtime (Browser ≥4 Jahre alt, Node ≥16).'
  );
}

/**
 * Generiert eine Match-ID
 * @returns UUID v4
 */
export function generateGroupStageMatchId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Match-ID
 * @returns UUID v4
 */
export function generateFinalsMatchId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Tournament-ID
 * @returns UUID v4
 */
export function generateTournamentId(): string {
  return generateUniqueId();
}

/**
 * Generiert eine Team-ID
 * @returns UUID v4 (kompatibel mit Supabase)
 */
export function generateTeamId(): string {
  return generateUniqueId();
}
