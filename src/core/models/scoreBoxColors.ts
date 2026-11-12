/**
 * Farbregel der Ergebniskästen (Spielanzeige 2.1, Spec § 4.1/§ 4.2; @ZM-140, @ZM-153, @ZM-154, @ZM-159, @ZM-161, @ZM-203, @ZM-204).
 *
 * - Teamfarben an: getragene Farbe je Seite; Leibchen-Seite als Weste (Mitte Leibchen, Streifen Trikot). Jeder Kasten zeigt seine
 *   echte Trikotfarbe, auch Blau gegen Blau – eine Ausweichfarbe gibt es nicht (Daniel 2026-11-08; @ZM-159 Fall D2).
 *   Eine Seite OHNE Trikotfarbe zeigt das Fallback-Muster „gestreift“ (`striped`, Daniel 2026-11-09, @ZM-203): schräg in zwei ruhigen
 *   Grautönen, Ziffer weiß; unter einem Leibchen derselbe Streifen-Ton in den Rändern der Weste (`stripesUnknown`, @ZM-204). Haben BEIDE
 *   Seiten keine Farbe, bleiben Heim und Gast in den Standardfarben (Fall A). Eine Platzhalter-Seite ohne Team („Erster Gruppe B“) behält ihre
 *   Standardfarbe; das Muster gilt nur für ein echtes Team ohne Trikotfarbe.
 * - Teamfarben aus: genau die eingestellten Standardfarben, auch wenn sie einander zu ähnlich sind (@ZM-153, Daniel 2026-11-09:
 *   „es wird gezeigt was Olli ausgewählt hat“); Leibchen nur als Zeichen (@ZM-154).
 */
import { normalizeKitColor, type KitSide } from './kit';
import type { SpectatorDisplaySettings } from './spectatorDisplay';
import { palette } from '../../design-tokens/colors/palette';

export const BOX_WHITE = palette.neutral[0];
export const BOX_BLACK = palette.kit.black;

/**
 * Die zwei Grautöne des Fallback-Musters. Beide halten zu einer weißen Ziffer mindestens 4,5 : 1 (Slate 500 = 4,76 : 1, Slate 700 = 10,3 : 1),
 * untereinander 2,2 : 1 (Ziel @ZM-204: mindestens 1,8 : 1); ein Test misst es (`scoreBoxColors.fallback.test.ts`).
 */
export const FALLBACK_PATTERN = Object.freeze({ light: palette.neutral[500], dark: palette.neutral[700] });

/**
 * Fläche eines Kastens: eine Farbe, Weste (Mitte = Leibchen, Streifen = Trikot; `stripesUnknown` = Trikotfarbe unbekannt, die Ränder tragen das
 * Muster, `stripes` ist dann der dunkle Ton) oder das Fallback-Muster (Seite ohne Trikotfarbe).
 */
export type BoxFill =
  | { kind: 'solid'; color: string }
  | { kind: 'vest'; center: string; stripes: string; stripesUnknown?: true }
  | { kind: 'striped'; light: string; dark: string };

/** Kasten einer Seite; `bib` = Leibchen-Zeichen oben links (auch bei „Teamfarben aus“). */
export interface SideBox {
  fill: BoxFill;
  bib: boolean;
}

export interface BoxColorInput {
  /** Getragene Farben (`wornColors`); fehlende Seite = keine Farbe. */
  worn: { a?: string; b?: string };
  bibSide?: KitSide;
  /** Trikot unter dem Leibchen; fehlt → Trikotfarbe unbekannt, die Ränder der Weste tragen das Muster (@ZM-204). */
  shirt?: string;
  /** Seite ohne Team (Platzhalter „Erster Gruppe B“): keine Trikotfarbe zu erfassen, also kein Muster – die Seite behält ihre Standardfarbe. */
  open?: { a?: boolean; b?: boolean };
  settings: SpectatorDisplaySettings;
}

const solid = (color: string): BoxFill => ({ kind: 'solid', color });
/** Das Fallback-Muster als Fläche (Seite ohne Trikotfarbe). */
export const unknownColorFill = (): BoxFill => ({ kind: 'striped', ...FALLBACK_PATTERN });

/** Zeigt der Kasten „Trikotfarbe unbekannt“ (Muster als Kasten oder unter dem Leibchen)? Dann liest die Anzeige den Satz vor (@ZM-203, @ZM-204). */
export function fillColorUnknown(fill: BoxFill): boolean {
  return fill.kind === 'striped' || (fill.kind === 'vest' && fill.stripesUnknown === true);
}

/** Beide Kästen in den eingestellten Standardfarben, genau wie Olli sie gewählt hat (@ZM-153). */
function standardFills(settings: SpectatorDisplaySettings): { a: BoxFill; b: BoxFill } {
  return { a: solid(settings.homeColor), b: solid(settings.awayColor) };
}

/** Grundfarbe der Fläche (Weste: Mitte, Muster: heller Ton) – für `data-color` und Messungen. */
export function fillBaseColor(fill: BoxFill): string {
  return fill.kind === 'solid' ? fill.color : fill.kind === 'vest' ? fill.center : fill.light;
}

function standardOf(side: KitSide, settings: SpectatorDisplaySettings): string {
  return side === 'a' ? settings.homeColor : settings.awayColor;
}

/** Fläche der Seite: Weste bei Leibchen (Trikot unbekannt → Muster in den Rändern), mit Farbe einfarbig, ohne Farbe das Fallback-Muster (Platzhalter: Standardfarbe). */
function sideFill(side: KitSide, color: string | undefined, input: BoxColorInput): BoxFill {
  if (color === undefined) {
    // Platzhalter-Seite (noch kein Team): Standardfarbe der Seite wie bisher; das Muster gilt nur für ein echtes Team ohne Trikotfarbe
    return input.open?.[side] === true ? solid(standardOf(side, input.settings)) : unknownColorFill();
  }
  if (input.bibSide !== side) {
    return solid(color);
  }
  const shirt = normalizeKitColor(input.shirt);
  return shirt === undefined
    ? { kind: 'vest', center: color, stripes: FALLBACK_PATTERN.dark, stripesUnknown: true }
    : { kind: 'vest', center: color, stripes: shirt };
}

/** Kastenfarben beider Seiten (`a` = Heim, `b` = Gast). */
export function resolveBoxColors(input: BoxColorInput): { a: SideBox; b: SideBox } {
  const a = normalizeKitColor(input.worn.a);
  const b = normalizeKitColor(input.worn.b);
  const bothUnknown = a === undefined && b === undefined;
  const fills = input.settings.teamColors && !bothUnknown
    ? { a: sideFill('a', a, input), b: sideFill('b', b, input) }
    : standardFills(input.settings);
  return {
    a: { fill: fills.a, bib: input.bibSide === 'a' },
    b: { fill: fills.b, bib: input.bibSide === 'b' },
  };
}
