/**
 * UUID-Erzeugung für Geräte und Konten. Die Einladungs-Tokens und der Einladungs-Link sind mit A-18a entfallen
 * (Helfer treten per QR-Code bei).
 */

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
