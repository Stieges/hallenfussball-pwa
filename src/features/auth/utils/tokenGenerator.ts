/**
 * Token Generator - URL-sichere Tokens für Einladungen und Sessions
 *
 * - 32 Zeichen Standard-Länge
 * - Keine verwechselbaren Zeichen (0/O, I/l)
 * - Kryptographisch sicher via crypto.getRandomValues()
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md Abschnitt 5.3
 */

/**
 * Erlaubte Zeichen für Token-Generierung
 * Ausgeschlossen: 0, O, I, l (leicht verwechselbar)
 */
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generiert einen kryptographisch sicheren, URL-safe Token
 *
 * @param length - Länge des Tokens (Standard: 32)
 * @returns URL-sicherer Token-String
 *
 * @example
 * ```ts
 * const inviteToken = generateToken(); // "Kj7nMpQr2xVbNm8sLwXy5tZcFg3hJk9d"
 * const sessionToken = generateToken(64);
 * ```
 */
export const generateToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join('');
};

/**
 * Generiert eine UUID v4
 *
 * @returns UUID-String im Format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * @example
 * ```ts
 * const id = generateUUID(); // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export const generateUUID = (): string => {
  // Nutze native crypto.randomUUID wenn verfügbar
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback für ältere Browser
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Prüft ob ein Token das erwartete Format hat
 *
 * @param token - Der zu prüfende Token
 * @param expectedLength - Erwartete Länge (Standard: 32)
 * @returns true wenn Token valide ist
 */
export const isValidTokenFormat = (token: string, expectedLength: number = 32): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  if (token.length !== expectedLength) {
    return false;
  }

  // Prüfe ob alle Zeichen im erlaubten Zeichensatz sind
  return [...token].every((char) => TOKEN_CHARS.includes(char));
};

/**
 * Generiert einen Einladungs-Link mit Token
 *
 * @param token - Der Einladungs-Token
 * @param baseUrl - Basis-URL der App (optional)
 * @returns Vollständiger Einladungs-Link
 *
 * @example
 * ```ts
 * const link = generateInviteLink("abc123");
 * // "https://app.example.com/invite?token=abc123"
 * ```
 */
export const generateInviteLink = (token: string, baseUrl?: string): string => {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://app.turnier.de');
  return `${base}/invite?token=${token}`;
};
