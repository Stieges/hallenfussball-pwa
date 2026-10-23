/**
 * Teamfarben und Leibchen (A-30a, Brief A-30 + Delta 2026-10-17): Regeln als reine Funktionen.
 *
 * - `kitConflict`: gleiche oder sehr ähnliche Trikotfarben (@SL-137, @SL-139), Abstand ΔE2000, Hinweis
 *   unter `KIT_SIMILAR_DELTA_E` (Daniel 2026-10-16, Prüfpunkt „Leibchen-Grenze“ in der Generalprobe) oder bei
 *   Helligkeitsabstand unter `KIT_SIMILAR_LUMINANCE_RATIO` (@SL-173).
 * - `defaultKit`: Vorbelegung beim Anpfiff – bei Konflikt trägt die Heimseite Leibchen in der Leibchenfarbe
 *   des Turniers (@W3-029, sonst Gelb). Liefert immer ein Objekt; `kit` geht bei jedem Anpfiff mit (F1).
 * - `wornColors`: getragene Farbe eines Spiels. Angepfiffene Spiele nehmen NUR die beim Anpfiff
 *   festgehaltene Farbe (`Match.kit`, Server-Spalten), geplante die aktuelle Teamfarbe (@W3-028).
 *   `undefined` = keine Farbe → die Anzeige nimmt ihre Vorgabe (@ZM-140 „Blau“).
 *
 * Farben sind normalisiert `#RRGGBB` (Großbuchstaben) – die einzige Form, die der Server speichert.
 */
import { z } from 'zod';
import type { Match, Team, Tournament } from '../../types/tournament';
import { slotTeamId } from './matchSlot';
import { hexDeltaE2000 } from './kitColorDistance';
import { getContrastRatio } from '../../design-tokens/display';

/** Seite eines Spiels: `a` = Heim, `b` = Gast (wie `kit_color_a/b`, `bib_side`). */
export type KitSide = 'a' | 'b';

/** Getragene Farben eines Spiels; fehlende Seite = keine Farbe. `bibSide` = Seite mit Leibchen. */
export interface MatchKit {
  a?: string;
  b?: string;
  bibSide?: KitSide;
}

export type KitConflict = 'same' | 'similar' | 'none';

/** @SL-139: unter diesem ΔE2000 gelten zwei Trikotfarben als zu ähnlich (Hinweis auf Leibchen). */
export const KIT_SIMILAR_DELTA_E = 30;

/**
 * @SL-173: unter diesem Helligkeitsabstand (WCAG-Kontrastverhältnis der beiden Trikotfarben) gelten zwei Farben
 * ebenfalls als zu ähnlich – ΔE2000 misst den Farbton, nicht die Helligkeit (Rot-Grün-Schwäche).
 * Die Grenze 1,5 : 1 ist ein Vorschlag (Controller 2026-10-22), Prüfpunkt „Leibchen-Grenze“ in der Generalprobe.
 */
export const KIT_SIMILAR_LUMINANCE_RATIO = 1.5;

/** @W3-029: Leibchenfarbe ohne Einstellung – Gelb aus der Trikot-Palette (Controller-Entscheidung F2). */
export const DEFAULT_BIB_COLOR = '#FFCC00';

const STORED_HEX = /^#[0-9A-F]{6}$/;
const INPUT_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Gespeicherte Form (lokale Kopie, Cloud): nur normalisierte Farben. */
export const MatchKitSchema = z.object({
  a: z.string().regex(STORED_HEX).optional(),
  b: z.string().regex(STORED_HEX).optional(),
  bibSide: z.enum(['a', 'b']).optional(),
});

/** Eingabe des Anpfiff-Befehls: Hex in Kurz- oder Langform, keine fremden Schlüssel. */
const KitInputSchema = z
  .object({
    a: z.string().regex(INPUT_HEX).optional(),
    b: z.string().regex(INPUT_HEX).optional(),
    bibSide: z.enum(['a', 'b']).optional(),
  })
  .strict();

/** `#fff`/`#ffffff` → `#FFFFFF`; alles andere (kein Hex, fehlt) → `undefined` („Farbe unbekannt“). */
export function normalizeKitColor(value: unknown): string | undefined {
  if (typeof value !== 'string' || !INPUT_HEX.test(value)) {
    return undefined;
  }
  const upper = value.toUpperCase();
  return upper.length === 4 ? `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}` : upper;
}

/** Kit ohne `undefined`-Schlüssel (stabile JSON-Form im Ausgang und in der lokalen Kopie). */
export function compactKit(kit: MatchKit): MatchKit {
  return {
    ...(kit.a !== undefined && { a: kit.a }),
    ...(kit.b !== undefined && { b: kit.b }),
    ...(kit.bibSide !== undefined && { bibSide: kit.bibSide }),
  };
}

/** Eingabe des Befehls prüfen und normalisieren; ungültig → `null`. */
export function parseKitInput(kit: unknown): MatchKit | null {
  const parsed = KitInputSchema.safeParse(kit);
  if (!parsed.success) {
    return null;
  }
  const { a, b, bibSide } = parsed.data;
  return compactKit({ a: normalizeKitColor(a), b: normalizeKitColor(b), bibSide });
}

/**
 * `luminance`: Helligkeitsregel @SL-173 mitprüfen. Pflicht für Leibchen-Hinweis und Zeile „Nächstes“ (`kitConflictWithLuminance`);
 * die Farben der Ergebniskästen für Zuschauer (@ZM-153, @ZM-159) prüfen ohne – dort zählt nur der Farbabstand.
 */
export interface KitConflictOptions {
  luminance: boolean;
}

/**
 * @SL-137/@SL-139: gleiche Farbe, zu ähnlich (ΔE2000 < 30) oder kein Konflikt; mit `luminance` auch Helligkeitsabstand
 * < 1,5 : 1 (@SL-173). Unbekannte Farbe → kein Konflikt.
 * Ohne die Option gilt nur der Farbabstand. Leibchen-Verbraucher (Anpfiff, Zeile „Nächstes“) nehmen
 * `kitConflictWithLuminance`; die Ergebniskästen der Zuschauer bleiben bei dieser Form.
 */
export function kitConflict(
  colorA: unknown,
  colorB: unknown,
  options: KitConflictOptions = { luminance: false },
): KitConflict {
  const a = normalizeKitColor(colorA);
  const b = normalizeKitColor(colorB);
  if (a === undefined || b === undefined) {
    return 'none';
  }
  if (a === b) {
    return 'same';
  }
  if (hexDeltaE2000(a, b) < KIT_SIMILAR_DELTA_E) {
    return 'similar';
  }
  return options.luminance && getContrastRatio(a, b) < KIT_SIMILAR_LUMINANCE_RATIO ? 'similar' : 'none';
}

/** @SL-173: Konflikt für Leibchen-Hinweis beim Anpfiff und Zeile „Nächstes“ – Farbabstand und Helligkeitsabstand. */
export function kitConflictWithLuminance(colorA: unknown, colorB: unknown): KitConflict {
  return kitConflict(colorA, colorB, { luminance: true });
}

type KitMatch = Pick<Match, 'slotA' | 'slotB'>;
type KitTeam = Pick<Team, 'id' | 'colors'>;
type KitTournament = Pick<Tournament, 'bibColor'>;

/** Trikotfarbe (Teamfarbe) einer Seite, normalisiert; offene Seite oder keine Farbe → `undefined`. */
function teamColor(match: KitMatch, side: KitSide, teams: readonly KitTeam[]): string | undefined {
  const teamId = slotTeamId(side === 'a' ? match.slotA : match.slotB);
  return teamId === undefined ? undefined : normalizeKitColor(teams.find((t) => t.id === teamId)?.colors?.primary);
}

/** @W3-029: Leibchenfarbe des Turniers, ohne (gültige) Einstellung Gelb. */
export function bibColorOf(tournament: KitTournament): string {
  return normalizeKitColor(tournament.bibColor) ?? DEFAULT_BIB_COLOR;
}

/** @SL-137: Leibchen für `bibSide` (Farbe änderbar, vorbelegt mit der Leibchenfarbe), die andere Seite in Teamfarbe. */
export function kitWithBib(
  match: KitMatch,
  teams: readonly KitTeam[],
  tournament: KitTournament,
  bibSide: KitSide,
  bibColor?: string,
): MatchKit {
  const bib = normalizeKitColor(bibColor) ?? bibColorOf(tournament);
  const a = bibSide === 'a' ? bib : teamColor(match, 'a', teams);
  const b = bibSide === 'b' ? bib : teamColor(match, 'b', teams);
  return compactKit({ a, b, bibSide });
}

/** Vorbelegung beim Anpfiff: bei Konflikt die Heimseite mit Leibchen (@SL-137), sonst die Teamfarben (@SL-138). */
export function defaultKit(match: KitMatch, teams: readonly KitTeam[], tournament: KitTournament): MatchKit {
  const a = teamColor(match, 'a', teams);
  const b = teamColor(match, 'b', teams);
  if (kitConflictWithLuminance(a, b) === 'none') {
    return compactKit({ a, b });
  }
  return kitWithBib(match, teams, tournament, 'a');
}

/**
 * Zustände VOR dem Anpfiff (Negativliste aus dem Status-Modell `MatchStatus`): fehlt, geplant, abgesetzt.
 * Jeder andere Zustand ist angepfiffen – auch der Cloud-Status `paused` (Halbzeit, Pause, Entscheidung,
 * Strafstoßschießen), den der Mapper ungeprüft durchreicht (Review A-30a B1).
 */
const NOT_KICKED_OFF: ReadonlySet<Match['matchStatus']> = new Set<Match['matchStatus']>([undefined, 'scheduled', 'skipped']);

function isKickedOff(match: Pick<Match, 'matchStatus'>): boolean {
  return !NOT_KICKED_OFF.has(match.matchStatus);
}

/** @W3-028/@ZM-140: getragene Farbe je Seite; `undefined` = keine Farbe (Anzeige: Vorgabe). */
export function wornColors(
  match: KitMatch & Pick<Match, 'matchStatus' | 'kit'>,
  teams: readonly KitTeam[],
): { a: string | undefined; b: string | undefined } {
  if (isKickedOff(match)) {
    return { a: match.kit?.a, b: match.kit?.b };
  }
  return { a: teamColor(match, 'a', teams), b: teamColor(match, 'b', teams) };
}
