/**
 * Teamfarben und Leibchen (A-30a, Brief A-30 + Delta 2026-10-17): Regeln als reine Funktionen.
 *
 * - `kitConflict`: „Karte nötig“ – gleiche oder sehr ähnliche Trikotfarben (@SL-137, @SL-139), Abstand ΔE2000 unter
 *   `KIT_SIMILAR_DELTA_E` (Daniel 2026-10-16, Prüfpunkt „Leibchen-Grenze“ in der Generalprobe).
 * - `kitSameBrightness`: Hinweis „gleich hell“ (Helligkeitsabstand unter `KIT_SIMILAR_LUMINANCE_RATIO`, @SL-173) – löst keine Karte aus
 *   (Daniel 2026-11-10), steht nur in der Zeile „Nächstes“ und in der Farbliste der Karte.
 * - Keine Vorbelegung beim Anpfiff (@SL-210): `kitBeimAnpfiff` (kitAnpfiff.ts) trägt nur, was Tom getippt hat; `kit` geht bei jedem Anpfiff mit (F1).
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

/**
 * Kit des Anpfiffs (`MATCH_START.payload.kit`): wie `MatchKit`, aber `bibSide: null` heißt ausdrücklich „Keine Leibchen“ (@SL-149);
 * ein fehlender Schlüssel `bibSide` heißt „nichts getippt“ (@SL-210), der Server lässt die Wahl dann, wie sie ist.
 */
export interface StartKit {
  a?: string;
  b?: string;
  bibSide?: KitSide | null;
}

export type KitConflict = 'same' | 'similar' | 'none';

/** Gespeicherte Wahl der Leibchen (`matches.kit_decision`): `bib` = bestätigt, `none` = „Keine Leibchen“ getippt; fehlt = offen (nichts getippt). */
export const KIT_DECISIONS = ['bib', 'none'] as const;
export type KitDecision = (typeof KIT_DECISIONS)[number];

/** Die drei Zustände der Karte (@SL-220): offen, keine Leibchen, bestätigt. Der Server kennt sie, nicht nur das Gerät. */
export type KitChoiceState = 'open' | 'none' | 'confirmed';

/** Gespeicherter Wert → Zustand der Karte (`undefined`/`null` = offen). */
export function kitChoiceState(decision: KitDecision | null | undefined): KitChoiceState {
  return decision === 'bib' ? 'confirmed' : decision === 'none' ? 'none' : 'open';
}

/** Wert aus der Cloud-Zeile; alles außer `bib`/`none` gilt als „nichts getippt“ (`undefined`). */
export function parseKitDecision(value: unknown): KitDecision | undefined {
  return KIT_DECISIONS.find((decision) => decision === value);
}

/** @SL-139: unter diesem ΔE2000 gelten zwei Trikotfarben als zu ähnlich (Hinweis auf Leibchen). */
export const KIT_SIMILAR_DELTA_E = 30;

/**
 * @SL-173: unter diesem Helligkeitsabstand (WCAG-Kontrastverhältnis der beiden Trikotfarben) zeigt die App den Hinweis „gleich hell“ –
 * ΔE2000 misst den Farbton, nicht die Helligkeit (Rot-Grün-Schwäche); keine Leibchen-Karte.
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
    bibSide: z.enum(['a', 'b']).nullable().optional(),
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

/** Kit ohne `undefined`-Schlüssel (stabile JSON-Form im Ausgang und in der lokalen Kopie); `bibSide: null` bleibt stehen (@SL-149). */
export function compactKit(kit: MatchKit): MatchKit;
export function compactKit(kit: StartKit): StartKit;
export function compactKit(kit: StartKit): StartKit {
  return {
    ...(kit.a !== undefined && { a: kit.a }),
    ...(kit.b !== undefined && { b: kit.b }),
    ...(kit.bibSide !== undefined && { bibSide: kit.bibSide }),
  };
}

/** Eingabe des Befehls prüfen und normalisieren; ungültig → `null`. */
export function parseKitInput(kit: unknown): StartKit | null {
  const parsed = KitInputSchema.safeParse(kit);
  if (!parsed.success) {
    return null;
  }
  const { a, b, bibSide } = parsed.data;
  return compactKit({ a: normalizeKitColor(a), b: normalizeKitColor(b), bibSide });
}

/**
 * @SL-137/@SL-139: „Karte nötig“ – gleiche Farbe, zu ähnlich (ΔE2000 < 30) oder kein Konflikt. NUR der Farbabstand: die Helligkeit löst keine Leibchen-Karte
 * mehr aus (@SL-173, Daniel 2026-11-10). Unbekannte Farbe → kein Konflikt. Dieselbe Rechnung gilt für die Ergebniskästen der Zuschauer (@ZM-153, @ZM-159).
 */
export function kitConflict(colorA: unknown, colorB: unknown): KitConflict {
  const a = normalizeKitColor(colorA);
  const b = normalizeKitColor(colorB);
  if (a === undefined || b === undefined) {
    return 'none';
  }
  if (a === b) {
    return 'same';
  }
  return hexDeltaE2000(a, b) < KIT_SIMILAR_DELTA_E ? 'similar' : 'none';
}

/**
 * @SL-173: „gleich hell“ – die beiden Farben liegen im Kontrast weniger als 1,5 : 1 auseinander (Rot-Grün-Schwäche). Wird weiter gemessen, löst aber
 * KEINE Leibchen-Karte aus; es ist nur ein Hinweis in der Zeile „Nächstes“ und in der Farbliste der Karte (@SL-231). Unbekannte Farbe → nie.
 */
export function kitSameBrightness(colorA: unknown, colorB: unknown): boolean {
  const a = normalizeKitColor(colorA);
  const b = normalizeKitColor(colorB);
  return a !== undefined && b !== undefined && getContrastRatio(a, b) < KIT_SIMILAR_LUMINANCE_RATIO;
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

/**
 * Zustände VOR dem Anpfiff (Negativliste aus dem Status-Modell `MatchStatus`): fehlt, geplant, abgesetzt.
 * Jeder andere Zustand ist angepfiffen – auch der Cloud-Status `paused` (Halbzeit, Pause, Entscheidung,
 * Strafstoßschießen), den der Mapper ungeprüft durchreicht (Review A-30a B1).
 */
const NOT_KICKED_OFF: ReadonlySet<Match['matchStatus']> = new Set<Match['matchStatus']>([undefined, 'scheduled', 'skipped']);

function isKickedOff(match: Pick<Match, 'matchStatus'>): boolean {
  return !NOT_KICKED_OFF.has(match.matchStatus);
}

/**
 * @W3-028/@ZM-140/@ZM-200: getragene Farbe je Seite; `undefined` = keine Farbe (Anzeige: Vorgabe).
 * - Angepfiffene Spiele nehmen NUR die beim Anpfiff festgehaltene Farbe (`Match.kit`).
 * - Noch nicht angepfiffene Spiele nehmen die aktuelle Teamfarbe – außer Tom hat Leibchen bestätigt (`kit.bibSide`, Leibchenfarbe an dieser Seite,
 *   Leibchen Schritt 2): dann trägt die Leibchen-Seite die Leibchenfarbe, die andere Seite bleibt in der Teamfarbe (@ZM-195, @ZM-200, @SL-201).
 */
export function wornColors(
  match: KitMatch & Pick<Match, 'matchStatus' | 'kit'>,
  teams: readonly KitTeam[],
): { a: string | undefined; b: string | undefined } {
  if (isKickedOff(match)) {
    return { a: match.kit?.a, b: match.kit?.b };
  }
  const trikot = { a: teamColor(match, 'a', teams), b: teamColor(match, 'b', teams) };
  const side = shownBibSide(match);
  const bib = side === undefined ? undefined : normalizeKitColor(match.kit?.[side]);
  return side !== undefined && bib !== undefined ? { ...trikot, [side]: bib } : trikot;
}

/**
 * Seite, die in der Anzeige das Leibchen trägt: nach dem Anpfiff die festgehaltene (`kit.bibSide`); davor nur die bestätigte Seite, und nur
 * solange dort ein Team steht (ein Platzhalter trägt keine Weste; der Server nimmt die Wahl bei einem Teamwechsel zurück, @SL-212).
 */
export function shownBibSide(match: KitMatch & Pick<Match, 'matchStatus' | 'kit'>): KitSide | undefined {
  const side = match.kit?.bibSide;
  if (side === undefined || isKickedOff(match)) {
    return side;
  }
  return slotTeamId(side === 'a' ? match.slotA : match.slotB) === undefined ? undefined : side;
}
