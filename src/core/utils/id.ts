/**
 * Kennungen für MatchEvent (C-EVID Sofort-Fix)
 *
 * `match_events.id` ist in Postgres eine `uuid`-Spalte. Neue Ereignisse brauchen also
 * eine echte UUID. Die vorhandene `generateUUID` liegt in
 * `src/features/auth/utils/tokenGenerator.ts` — `core/` darf aber nicht aus `features/`
 * importieren (ESLint-Layering, siehe `.claude/conventions/LAYERING.md`), deshalb eine
 * eigenständige, kleine Implementierung hier.
 */

/** RFC-4122-Format (8-4-4-4-12 Hex), unabhängig von Version/Variante geprüft — das reicht
 *  Postgres' `uuid`-Spaltentyp. */
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prüft, ob eine Kennung bereits dem UUID-Format entspricht. */
export function isUuidFormat(id: string): boolean {
  return UUID_FORMAT.test(id);
}

/** Erzeugt eine neue, zufällige UUID für ein neues MatchEvent. */
export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Ausweichpfad (Review-Fix Minor 4, Fixrunde 1): crypto.randomUUID() fehlt außerhalb
  // sicherer Kontexte (z. B. HTTP über eine LAN-IP) — genau dort greift dieser Zweig.
  // crypto.getRandomValues() ist dort weiterhin verfügbar (kein sicherer Kontext nötig),
  // anders als Math.random(), das nicht kryptographisch stark ist. Mit `ignoreDuplicates`
  // würde eine Kollision ein Ereignis still verwerfen — mit echten Zufallsbytes ist die
  // Wahrscheinlichkeit dafür praktisch null.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version-Nibble auf 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant-Nibble auf RFC 4122 (8/9/a/b)

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * FNV-1a (32-bit) — kleine, deterministische, nicht-kryptographische Hashfunktion ohne
 * externe Abhängigkeit. Wird in `toDeterministicUuid` viermal mit unterschiedlichem Seed
 * über dieselbe Eingabe gerechnet, um 128 Bit (4 × 32 Bit) für ein UUID-förmiges Ergebnis
 * zu gewinnen.
 */
function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-Bit-Multiplikation mit der FNV-Primzahl (0x01000193), überlaufsicher via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Vier unabhängige Seeds (Bit-Muster ohne besondere Bedeutung) für die vier 32-Bit-Läufe. */
const FNV_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35] as const;

/**
 * Rechnet eine bestehende Text-Kennung deterministisch in eine UUID um: gleiche Eingabe
 * → gleiche UUID, unterschiedliche Eingaben → (praktisch) unterschiedliche UUIDs.
 *
 * Grund: Alt-Ereignisse haben lokale IDs wie `${matchId}-goal-${Date.now()}-${zufall}`
 * (kein UUID-Format). Damit sie beim Übertragen nicht an der `uuid`-Spalte scheitern und
 * eine Wiederholung nicht dieselbe Zeile doppelt anlegt, muss dieselbe Text-Kennung bei
 * jedem Aufruf exakt dieselbe UUID ergeben.
 *
 * Hashverfahren: FNV-1a (32-bit), viermal mit unterschiedlichem Seed über die Eingabe
 * gerechnet → 128-Bit-Digest, formatiert im UUID-Layout (Version-Nibble '8' = "custom",
 * RFC 9562 — markiert die ID als nicht-zufällig erzeugt; Variant-Nibble RFC-4122-konform).
 *
 * Kollisionen sind hier unkritisch: pro Spiel entstehen wenige Dutzend Ereignisse, und die
 * Eingabe (matchId + Ereignistyp/Zeitstempel + Zufallssuffix) ist praktisch eindeutig.
 * Selbst eine Kollision zweier unterschiedlicher Alt-Kennungen auf dieselbe UUID würde nur
 * dazu führen, dass das zweite Ereignis beim Hochladen fälschlich als "schon übertragen"
 * gilt (`upsert` mit `ignoreDuplicates`) und sein `match_events`-Eintrag fehlt — kein
 * korrupter Spielstand, im schlimmsten Fall ein fehlender Protokoll-Eintrag.
 */
export function toDeterministicUuid(localId: string): string {
  const hex = FNV_SEEDS.map((seed) => fnv1a32(localId, seed).toString(16).padStart(8, '0')).join('');

  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);
  const timeHiAndVersion = '8' + hex.slice(13, 16); // Version-Nibble fest auf '8' (custom)
  const variantNibble = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const clockSeq = variantNibble + hex.slice(17, 20);
  const node = hex.slice(20, 32);

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeq}-${node}`;
}

/**
 * Kennung, die tatsächlich in `match_events.id` (Postgres `uuid`) geschrieben wird: eine
 * echte UUID bleibt unverändert, alles andere wird deterministisch umgerechnet. Die lokale
 * Kennung (`MatchEvent.id`) selbst bleibt in beiden Fällen unverändert — nur der an
 * Supabase gesendete Wert ändert sich.
 */
export function toSupabaseEventId(localId: string): string {
  return isUuidFormat(localId) ? localId : toDeterministicUuid(localId);
}
