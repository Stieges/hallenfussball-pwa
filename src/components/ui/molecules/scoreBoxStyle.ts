/**
 * Farben und Maße des Ergebniskastens (Aufgabe 2.2 Spielanzeige, Mockups `monitor-weste.html`, `karte-handy.html`): nur Tokens.
 *
 * - Ziffern-Kontrast wird auf der WIRKSAMEN Fläche bestimmt (bei der Weste die Mitte, beim Verlierer die gedämpfte Farbe),
 *   immer ≥ 4,5 : 1 (@ZM-156, @ZM-160); schwarz oder weiß, je nachdem, was mehr Kontrast gibt.
 * - Rahmen: hebt sich Mitte ODER Streifen (gedämpft, wie gezeigt) mit weniger als 3 : 1 vom Hintergrund ab, ist er kräftig (@ZM-140, @ZM-161).
 * - Die Kastengröße hängt nie vom Zustand ab: Rahmen innen (border-box), Ring als outline, Ecken absolut außerhalb (@ZM-151, @ZM-160).
 */
import type { CSSProperties } from 'react';
import { BOX_BLACK, BOX_WHITE, type BoxFill } from '../../../core/models/scoreBoxColors';
import { borderWidths, cssVars, displayLayout, displayList } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';
import { getBlockFrame, mixHex, type BlockFrame, type BlockFrameWidths } from '../../../design-tokens/displayColor';

export type ScoreBoxSize = 'display' | 'row' | 'compact' | 'cockpit';
export type ScoreBoxOutcome = 'winner' | 'loser';
export type ScoreBoxMark = 'cup' | 'bib';

const L = displayLayout.scoreArea;

/** Dämpfung des Verlierers als Zahl; abgeleitet aus dem Token `loserDimShare` („30%“), kein zweiter Wert (B4). */
export const LOSER_DIM_SHARE = parseFloat(L.loserDimShare) / 100;

/** Anteil (0 bis 1) als Prozentzahl ohne Gleitkomma-Reste (0,14 → 14, nicht 14,000000000000002). */
const percent = (share: number): number => Math.round(share * 100 * 1000) / 1000;

/** Farben, wie sie auf dem Kasten erscheinen: beim Verlierer um `LOSER_DIM_SHARE` zum Hintergrund hin gemischt. */
function shownColors(fill: BoxFill, outcome: ScoreBoxOutcome | undefined, background: string): { center: string; stripes: string } {
  const dim = (color: string): string => (outcome === 'loser' ? mixHex(color, background, LOSER_DIM_SHARE) : color);
  return fill.kind === 'vest'
    ? { center: dim(fill.center), stripes: dim(fill.stripes) }
    : { center: dim(fill.color), stripes: dim(fill.color) };
}

/** Farbe, auf der die Ziffer steht (Mitte der Weste), mit Dämpfung des Verlierers. */
export function effectiveDigitBackground(fill: BoxFill, outcome: ScoreBoxOutcome | undefined, background: string): string {
  return shownColors(fill, outcome, background).center;
}

/** Ziffernfarbe mit dem höheren Kontrast zur wirksamen Fläche (mindestens 4,5 : 1). */
export function digitColor(fill: BoxFill, outcome: ScoreBoxOutcome | undefined, background: string): '#FFFFFF' | '#000000' {
  const flaeche = effectiveDigitBackground(fill, outcome, background);
  return getContrastRatio(flaeche, BOX_BLACK) > getContrastRatio(flaeche, BOX_WHITE) ? BOX_BLACK : BOX_WHITE;
}

/** Schwächerer der gezeigten Farben (Mitte oder Streifen) gegenüber dem Hintergrund. */
function weakestColor(fill: BoxFill, outcome: ScoreBoxOutcome | undefined, background: string): string {
  const { center, stripes } = shownColors(fill, outcome, background);
  return getContrastRatio(stripes, background) < getContrastRatio(center, background) ? stripes : center;
}

/** Mitte ODER Streifen heben sich mit weniger als 3 : 1 vom Hintergrund ab → kräftiger Rahmen (@ZM-140, @ZM-161). */
export function needsStrongFrame(fill: BoxFill, background: string, outcome?: ScoreBoxOutcome): boolean {
  return getContrastRatio(weakestColor(fill, outcome, background), background) < 3;
}

interface SizeLayout {
  width: string;
  height: string;
  fontSize?: string;
  radius: string;
  frame: BlockFrameWidths;
  ringWidth: string;
  ringOffset: string;
  digitFontSize: string;
}

/**
 * Ziffernhöhe im Monitor-Kasten (Controller-Zusatz zu H3, gleiche Regel wie `monitor/scoreDigitSize.ts`): höchstens 60 % der
 * Kastenhöhe und 50 % der Kastenbreite; `ui/` darf nicht aus `components/monitor` importieren.
 */
const DIGIT_HEIGHT_MAX_OF_BOX = 0.6;
const DIGIT_WIDTH_MAX_OF_BOX = 0.5;
/** Zeilen-Kasten (Monitor-Folienzeile): Maße in em der Zeilenschrift `displayList.fontSizes.team` (Feinschliff in Aufgabe 3.2). */
const ROW_BOX_WIDTH_EM = 2.4;
const ROW_BOX_HEIGHT_EM = 1.8;
/** Ecken: Versatz über/neben der Kastenecke als Bruchteil des Kreisdurchmessers (wie `LiveScoreGrid`, Mockup K5g) und Symbolanteil. */
const CORNER_TOP_DIVISOR = 3;
const CORNER_SIDE_DIVISOR = 5;
const MARK_ICON_SHARE = 0.6;
const SMALL_FRAME: BlockFrameWidths = { subtle: borderWidths.medium, strong: borderWidths.strong };

const LAYOUTS: Record<ScoreBoxSize, SizeLayout> = {
  display: {
    width: '100%',
    height: '100%',
    radius: cssVars.borderRadius.lg,
    frame: { subtle: L.frameWidthSubtle, strong: L.frameWidthStrong },
    ringWidth: L.frameWidthStrong,
    ringOffset: L.frameWidthSubtle,
    digitFontSize: `min(${DIGIT_HEIGHT_MAX_OF_BOX * 100}cqh, ${DIGIT_WIDTH_MAX_OF_BOX * 100}cqw)`,
  },
  row: {
    width: `${ROW_BOX_WIDTH_EM}em`,
    height: `${ROW_BOX_HEIGHT_EM}em`,
    fontSize: displayList.fontSizes.team,
    radius: cssVars.borderRadius.md,
    frame: SMALL_FRAME,
    ringWidth: borderWidths.medium,
    ringOffset: borderWidths.medium,
    digitFontSize: 'inherit',
  },
  /** Cockpit (@SL-176, @SL-178): Breite füllt die Zelle, Höhe und Ziffer kommen je Stufe aus `--cockpit-kasten` / `--cockpit-ziffer` (Tafel setzt sie aus den Tokens) */
  cockpit: {
    width: '100%',
    height: 'var(--cockpit-kasten)',
    radius: cssVars.borderRadius.md,
    frame: SMALL_FRAME,
    ringWidth: borderWidths.medium,
    ringOffset: borderWidths.medium,
    digitFontSize: 'var(--cockpit-ziffer)',
  },
  compact: {
    width: cssVars.touchTargets.primary,
    height: cssVars.touchTargets.minimum,
    fontSize: cssVars.fontSizes.xxl,
    radius: cssVars.borderRadius.md,
    frame: SMALL_FRAME,
    ringWidth: borderWidths.medium,
    ringOffset: borderWidths.medium,
    digitFontSize: 'inherit',
  },
};

export type FrameStrength = 'subtle' | 'strong';

/**
 * Rahmen des Kastens: Breite nach Größe, kräftig in voller Textfarbe, sonst dezent. `strength` (vom Aufrufer für das Paar
 * bestimmt, `pairFrameStrength`) erzwingt die Breite; die Farbe richtet sich weiter nach dem eigenen Kasten.
 */
export function frameOf(
  fill: BoxFill,
  outcome: ScoreBoxOutcome | undefined,
  background: string,
  textColor: string,
  size: ScoreBoxSize,
  strength?: FrameStrength,
): BlockFrame {
  const widths = LAYOUTS[size].frame;
  const frame = getBlockFrame(weakestColor(fill, outcome, background), background, textColor, widths);
  return strength === undefined ? frame : { ...frame, width: widths[strength] };
}

interface PairSide {
  fill: BoxFill;
  outcome?: ScoreBoxOutcome;
}

/** Gleiche Rahmenbreite beider Kästen (Entscheidung Daniel 15.10.): braucht einer den kräftigen Rahmen, bekommen ihn beide. */
export function pairFrameStrength(home: PairSide, away: PairSide, background: string): FrameStrength {
  return needsStrongFrame(home.fill, background, home.outcome) || needsStrongFrame(away.fill, background, away.outcome) ? 'strong' : 'subtle';
}

export interface BoxStyleInput {
  fill: BoxFill;
  size: ScoreBoxSize;
  background: string;
  textColor: string;
  outcome: ScoreBoxOutcome | undefined;
  ringColor: string;
  frameStrength?: FrameStrength;
}

/** Wurzel des Kastens: feste Maße, Fläche (Farbe oder Weste), Rahmen, Ring nur beim Sieger. */
export function boxStyle({ fill, size, background, textColor, outcome, ringColor, frameStrength }: BoxStyleInput): CSSProperties {
  const layout = LAYOUTS[size];
  const colors = shownColors(fill, outcome, background);
  const frame = frameOf(fill, outcome, background, textColor, size, frameStrength);
  const stripe = percent(L.vestStripeShare);
  const surface: CSSProperties = {
    backgroundColor: colors.center,
    ...(fill.kind === 'vest'
      ? {
          backgroundImage: `linear-gradient(90deg, ${colors.stripes} ${stripe}%, ${colors.center} ${stripe}%, ${colors.center} ${100 - stripe}%, ${colors.stripes} ${100 - stripe}%)`,
          backgroundOrigin: 'border-box' as const,
        }
      : {}),
  };
  return {
    position: 'relative',
    display: size === 'display' || size === 'cockpit' ? 'block' : 'inline-block',
    flex: size === 'display' || size === 'cockpit' ? undefined : 'none',
    boxSizing: 'border-box',
    width: layout.width,
    height: layout.height,
    fontSize: layout.fontSize,
    borderRadius: layout.radius,
    borderStyle: 'solid',
    borderWidth: frame.width,
    borderColor: frame.color,
    color: digitColor(fill, outcome, background),
    ...surface,
    ...(outcome === 'winner'
      ? { outlineStyle: 'solid', outlineWidth: layout.ringWidth, outlineColor: ringColor, outlineOffset: layout.ringOffset }
      : {}),
  };
}

/** Fläche, die die Ziffer mittig trägt; am Monitor der Container für die Ziffernhöhe (cqh/cqw). */
export function digitAreaStyle(size: ScoreBoxSize): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    containerType: size === 'display' ? 'size' : undefined,
  };
}

export function digitsStyle(size: ScoreBoxSize): CSSProperties {
  return {
    fontSize: LAYOUTS[size].digitFontSize,
    fontWeight: cssVars.fontWeights.extrabold,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    userSelect: 'none',
  };
}

/** Pokal (oben rechts) und Leibchen-Zeichen (oben links): absolut außerhalb der Ziffernfläche, Farben aus den Props. */
export function markStyle(kind: ScoreBoxMark, size: ScoreBoxSize, colors: { background: string; textColor: string; ringColor: string }): CSSProperties {
  const display = size === 'display';
  const diameter = display ? L.monitorCup : kind === 'cup' ? cssVars.iconSizes.md : cssVars.iconSizes.sm;
  const top = display ? `calc(-1 * ${diameter} / ${CORNER_TOP_DIVISOR})` : `calc(-1 * ${kind === 'cup' ? cssVars.spacing.md : cssVars.spacing.sm})`;
  const side = display ? `calc(-1 * ${diameter} / ${CORNER_SIDE_DIVISOR})` : top;
  return {
    position: 'absolute',
    top,
    ...(kind === 'cup' ? { right: side } : { left: side }),
    width: diameter,
    height: diameter,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: cssVars.borderRadius.full,
    borderStyle: 'solid',
    borderWidth: display ? L.frameWidthSubtle : borderWidths.medium,
    borderColor: colors.background,
    backgroundColor: kind === 'cup' ? colors.ringColor : colors.textColor,
    color: colors.background,
    fontSize: `calc(${diameter} * ${MARK_ICON_SHARE})`,
  };
}

/** Fläche eines Kastens als Hintergrund (Farbe oder Weste mit Streifen); für Köpfe, die dieselbe Farbe tragen (Cockpit-Team-Kopf, @SL-176). */
export function fillSurface(fill: BoxFill): CSSProperties {
  const colors = shownColors(fill, undefined, '#000000');
  const stripe = percent(L.vestStripeShare);
  return {
    backgroundColor: colors.center,
    ...(fill.kind === 'vest'
      ? { backgroundImage: `linear-gradient(90deg, ${colors.stripes} ${stripe}%, ${colors.center} ${stripe}%, ${colors.center} ${100 - stripe}%, ${colors.stripes} ${100 - stripe}%)` }
      : {}),
  };
}

/** Schriftfarbe auf der Fläche des Kastens (Schwarz oder Weiß, mindestens 4,5 : 1). */
export function fillTextColor(fill: BoxFill): '#FFFFFF' | '#000000' {
  return digitColor(fill, undefined, '#000000');
}
