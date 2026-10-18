/**
 * B-08b (@FU-070): feste Ereignis-ID für das automatische Ende an der Grenze eines Abschnitts.
 *
 * Zwei Geräte, die dieselbe Grenze desselben Spiels erreichen, bauen dasselbe Ereignis (Typ, Abschnitt,
 * Spielzeit der Grenze, Zeitpunkt der Grenze). Mit derselben ID erkennt der Server das zweite als Wiederholung
 * (`duplicate`, `append_match_events`: gleiche ID + gleicher Inhalt) statt es als ungültigen Übergang abzulehnen.
 * Rein, ohne Zufall und ohne Uhr; die Zahl der Wiedereröffnungen trennt ein Ende nach „Spiel fortsetzen“.
 */
export interface AutoEndSeed {
  matchId: string;
  kind: 'SECTION_END' | 'MATCH_END';
  /** Abschnitt, der endet (1-basiert; Verlängerung = Zahl der regulären Abschnitte + 1). */
  section: number;
  /** Spielzeit der Grenze in ms (absolute Spieluhr). */
  limitClockMs: number;
  reopenCount: number;
}

/** 32-Bit-FNV-1a mit eigenem Startwert; vier Läufe ergeben 128 Bit. */
function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const SEEDS = [0x811c9dc5, 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35] as const;

function hex(value: number): string {
  return value.toString(16).padStart(8, '0');
}

export function autoEndEventId(seed: AutoEndSeed): string {
  const text = `${seed.matchId}|${seed.kind}|${seed.section}|${seed.limitClockMs}|${seed.reopenCount}`;
  const digits = SEEDS.map((start) => hex(fnv1a(text, start))).join('');
  // Version 5 und Variante 10xx, damit die ID eine gültige UUID ist (Umschlag des Servers).
  const version = `5${digits.slice(13, 16)}`;
  const variant = `${(8 + (parseInt(digits.charAt(16), 16) & 3)).toString(16)}${digits.slice(17, 20)}`;
  return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${version}-${variant}-${digits.slice(20, 32)}`;
}
