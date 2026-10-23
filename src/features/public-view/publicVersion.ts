/**
 * Version des heutigen Lesewegs (B-15, Adapter (a)): `getByShareCode` kennt kein `since_version` und liefert immer das
 * ganze Turnier. Die Version einer Antwort ist deshalb ein Fingerabdruck ihres Inhalts; nur wenn er sich ändert, wird neu
 * gerechnet und gezeichnet. (`tournaments.version` reicht nicht: ein Tor ändert nur die Spielzeile.)
 */
import type { Tournament } from '../../types/tournament';

const HASH_MULTIPLIER_A = 2654435761;
const HASH_MULTIPLIER_B = 1597334677;
const HASH_SPREAD = 4294967296;
const HASH_SHIFT = 16;
const HASH_SEED_B = 0x41c6ce57;
const HASH_SEED_A = 0xdeadbeef;
const HEX = 16;
const HASH_WIDTH = 8;
const MIX_A = 2246822507;
const MIX_B = 3266489909;
const HASH_HIGH_BITS = 2097151;

/** 53-Bit-Hash (cyrb53) eines Textes: kurz, ohne Abhängigkeit, für Fingerabdrücke und nicht für Sicherheit. */
function hash53(text: string): number {
  let h1 = HASH_SEED_A;
  let h2 = HASH_SEED_B;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, HASH_MULTIPLIER_A);
    h2 = Math.imul(h2 ^ ch, HASH_MULTIPLIER_B);
  }
  h1 = Math.imul(h1 ^ (h1 >>> HASH_SHIFT), MIX_A) ^ Math.imul(h2 ^ (h2 >>> 13), MIX_B);
  h2 = Math.imul(h2 ^ (h2 >>> HASH_SHIFT), MIX_A) ^ Math.imul(h1 ^ (h1 >>> 13), MIX_B);
  return HASH_SPREAD * (HASH_HIGH_BITS & h2) + (h1 >>> 0);
}

/** Fingerabdruck des Turnier-Inhalts; gleicher Inhalt → gleiche Version. */
export function contentVersionOf(tournament: Tournament): string {
  const text = JSON.stringify(tournament);
  return `${hash53(text).toString(HEX).padStart(HASH_WIDTH, '0')}-${String(text.length)}`;
}
