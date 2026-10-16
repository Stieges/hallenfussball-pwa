/**
 * tests/e2e/cloud/e2eUuid.ts — deterministische IDs (aus `testData.ts` herausgelöst, damit
 * `engineCups.ts` ohne Importzyklus darauf zugreift; `testData.ts` re-exportiert die Funktion).
 */

import { createHash } from 'node:crypto';

/**
 * Deterministische UUID aus einem stabilen Seed-String (keine Zufallswerte, kein `uuid`-Paket
 * nötig). Kein RFC-4122-v5 (kein externes Namespace-Hashing-Schema vorgeschrieben) — nur
 * stabil, kollisionsarm (SHA-256) und ein gültiges `uuid`-Spaltenformat für Postgres.
 */
export function e2eUuid(seed: string): string {
  const hash = createHash('sha256').update(`hallenfussball-e2e:${seed}`).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  // Version-Nibble auf "4" (kosmetisch, Postgres erzwingt das nicht, hält die IDs aber
  // von echten, per gen_random_uuid() erzeugten Zeilen visuell unterscheidbar).
  bytes[12] = '4';
  const hex = bytes.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
