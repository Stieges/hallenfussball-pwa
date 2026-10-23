/**
 * Farbregel der Ergebniskästen (Spielanzeige 2.1, Spec § 4.1/§ 4.2; @ZM-140, @ZM-153, @ZM-154, @ZM-159, @ZM-161).
 *
 * - Teamfarben an: getragene Farbe je Seite; Leibchen-Seite als Weste (Mitte Leibchen, Streifen Trikot – ohne Trikotfarbe
 *   die Standardfarbe der Seite, D-3). Seite ohne Farbe bzw. gleiche Farbe ohne Leibchen (D2) weicht aus: eigene
 *   Standardfarbe → Standardfarbe der anderen Seite → Weiß oder Schwarz, was vom Gegner weiter entfernt ist (D-1).
 * - Teamfarben aus: Standardfarben, Leibchen nur als Zeichen (@ZM-154). Zu ähnliche Standardfarben → Gast Weiß/Schwarz.
 *
 * „Zu ähnlich“ = `kitConflict(x, y) !== 'none'` (nur ΔE2000 < 30, @SL-139; ohne Helligkeitsregel @SL-173). Weiß/Schwarz sind Daten (Ausweichfarben).
 */
import { kitConflict, normalizeKitColor, type KitSide } from './kit';
import { hexDeltaE2000 } from './kitColorDistance';
import type { SpectatorDisplaySettings } from './spectatorDisplay';
import { palette } from '../../design-tokens/colors/palette';

export const BOX_WHITE = palette.neutral[0];
export const BOX_BLACK = palette.kit.black;

/** Fläche eines Kastens: eine Farbe oder Weste (Mitte = Leibchen, Streifen = Trikot). */
export type BoxFill = { kind: 'solid'; color: string } | { kind: 'vest'; center: string; stripes: string };

/** Kasten einer Seite; `bib` = Leibchen-Zeichen oben links (auch bei „Teamfarben aus“). */
export interface SideBox {
  fill: BoxFill;
  bib: boolean;
}

export interface BoxColorInput {
  /** Getragene Farben (`wornColors`); fehlende Seite = keine Farbe. */
  worn: { a?: string; b?: string };
  bibSide?: KitSide;
  /** Trikot unter dem Leibchen; fehlt → Standardfarbe der Leibchen-Seite (D-3). */
  shirt?: string;
  settings: SpectatorDisplaySettings;
}

const tooSimilar = (x: string, y: string): boolean => kitConflict(x, y) !== 'none';
const solid = (color: string): BoxFill => ({ kind: 'solid', color });
const other = (side: KitSide): KitSide => (side === 'a' ? 'b' : 'a');

/** @ZM-159 (D-1): Weiß oder Schwarz, je nachdem, was von `hex` weiter entfernt ist (ΔE2000); Gleichstand → Weiß. */
export function whiteOrBlackFarthestFrom(hex: string): '#FFFFFF' | '#000000' {
  const color = normalizeKitColor(hex) ?? BOX_WHITE;
  return hexDeltaE2000(color, BOX_BLACK) > hexDeltaE2000(color, BOX_WHITE) ? BOX_BLACK : BOX_WHITE;
}

function standardOf(side: KitSide, settings: SpectatorDisplaySettings): string {
  return side === 'a' ? settings.homeColor : settings.awayColor;
}

/** Ausweichregel für `side` gegen die Farbe `opponent` (Fall B, D2). */
function evade(side: KitSide, opponent: string, settings: SpectatorDisplaySettings): string {
  const own = standardOf(side, settings);
  if (!tooSimilar(own, opponent)) {
    return own;
  }
  const otherStandard = standardOf(other(side), settings);
  return tooSimilar(otherStandard, opponent) ? whiteOrBlackFarthestFrom(opponent) : otherStandard;
}

/** Beide Kästen in Standardfarben (Fall A, „Teamfarben aus“): bei zu ähnlichen Standardfarben weicht der Gast aus. */
function standardFills(settings: SpectatorDisplaySettings): { a: BoxFill; b: BoxFill } {
  const { homeColor, awayColor } = settings;
  return { a: solid(homeColor), b: solid(tooSimilar(homeColor, awayColor) ? whiteOrBlackFarthestFrom(homeColor) : awayColor) };
}

/** Fläche der Seite mit Farbe: Weste bei Leibchen, sonst die Farbe. */
function wornFill(side: KitSide, color: string, input: BoxColorInput): BoxFill {
  if (input.bibSide !== side) {
    return solid(color);
  }
  return { kind: 'vest', center: color, stripes: normalizeKitColor(input.shirt) ?? standardOf(side, input.settings) };
}

/** Farbe, gegen die der Gegner ausweicht: bei Weste die Mitte. */
const centerOf = (fill: BoxFill): string => (fill.kind === 'vest' ? fill.center : fill.color);

function teamColorFills(a: string | undefined, b: string | undefined, input: BoxColorInput): { a: BoxFill; b: BoxFill } {
  const { settings } = input;
  // Fall A: keine Seite mit Farbe. Fall B: die Seite ohne Farbe weicht von der anderen aus (bei Weste von deren Mitte).
  if (a === undefined) {
    if (b === undefined) {
      return standardFills(settings);
    }
    const fillB = wornFill('b', b, input);
    return { a: solid(evade('a', centerOf(fillB), settings)), b: fillB };
  }
  const fillA = wornFill('a', a, input);
  if (b === undefined) {
    return { a: fillA, b: solid(evade('b', centerOf(fillA), settings)) };
  }
  // D2: gleiche bzw. zu ähnliche Farben ohne Leibchen → die Gastseite weicht aus wie in B.
  if (input.bibSide === undefined && tooSimilar(a, b)) {
    return { a: fillA, b: solid(evade('b', a, settings)) };
  }
  return { a: fillA, b: wornFill('b', b, input) };
}

/** Kastenfarben beider Seiten (`a` = Heim, `b` = Gast). */
export function resolveBoxColors(input: BoxColorInput): { a: SideBox; b: SideBox } {
  const a = normalizeKitColor(input.worn.a);
  const b = normalizeKitColor(input.worn.b);
  const fills = input.settings.teamColors ? teamColorFills(a, b, input) : standardFills(input.settings);
  return {
    a: { fill: fills.a, bib: input.bibSide === 'a' },
    b: { fill: fills.b, bib: input.bibSide === 'b' },
  };
}
