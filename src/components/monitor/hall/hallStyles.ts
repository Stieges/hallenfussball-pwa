/**
 * Stile des Profils „Halle (sehr fern)“ (@ZM-213, @ZM-214): nur Tokens (`displayHall`, Farben aus Thema und Kasten-Regeln).
 * Jede Größe hängt nur von der Folienfläche ab, nie vom Zustand des Spiels: die Flächen, Namen und Torzahlen stehen immer an derselben Stelle (@ZM-151).
 */
import type { CSSProperties } from 'react';
import type { SideBox } from '../../../core/models/scoreBoxColors';
import { cssVars, displayHall, displayLayout, type MonitorThemeColors } from '../../../design-tokens';
import {
  digitColor, frameOf, shownColorsOf, stripedImage, type FrameStrength, type ScoreBoxOutcome,
} from '../../ui/molecules/scoreBoxStyle';

const panel = displayHall.panel;

export const rootStyle = (colors: MonitorThemeColors): CSSProperties => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: `${panel.height} auto minmax(0, 1fr)`,
  background: colors.backgroundGradient,
  color: colors.text,
  fontFamily: cssVars.fontFamilies.body,
});

export const panelRowStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  columnGap: panel.gap,
};

interface PanelInput {
  box: SideBox;
  outcome: ScoreBoxOutcome | undefined;
  colors: MonitorThemeColors;
  frame: FrameStrength;
}

/** Farbfläche der Seite: getragene Farbe (Leibchen: Leibchenfarbe, ohne Trikotfarbe: Streifen), Rahmen bei zu wenig Kontrast, Ring beim Sieger. */
export function panelStyle({ box, outcome, colors, frame }: PanelInput): CSSProperties {
  const shown = shownColorsOf(box.fill, outcome, colors.background);
  const border = frameOf(box.fill, outcome, colors.background, colors.text, 'display', frame);
  return {
    position: 'relative',
    boxSizing: 'border-box',
    minWidth: 0,
    borderRadius: `0 0 ${panel.radius} ${panel.radius}`,
    borderStyle: 'solid',
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: shown.center,
    ...(box.fill.kind === 'striped' ? { backgroundImage: stripedImage(shown.center, shown.stripes, 'display') } : {}),
    color: digitColor(box.fill, outcome, colors.background),
    ...(outcome === 'winner' ? { boxShadow: `inset 0 0 0 ${panel.ringWidth} ${colors.progressBar}` } : {}),
  };
}

/** Namensfeld oben in der Fläche: feste Lage und Höhe, der Name steht darin mittig (ein bis zwei Zeilen). */
export const nameFieldStyle: CSSProperties = {
  position: 'absolute',
  top: displayHall.name.top,
  left: displayHall.name.padX,
  right: displayHall.name.padX,
  height: displayHall.name.height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
};

export const nameStyle = (outcome: ScoreBoxOutcome | undefined, gemessen: boolean): CSSProperties => ({
  width: '100%',
  visibility: gemessen ? 'visible' : 'hidden',
  fontSize: displayHall.name.maxFont,
  fontWeight: outcome === 'loser' ? cssVars.fontWeights.semibold : cssVars.fontWeights.bold,
  lineHeight: displayHall.name.lineHeight,
  letterSpacing: displayHall.name.letterSpacing,
  textAlign: 'center',
  overflowWrap: 'normal',
  whiteSpace: 'normal',
});

export const digitStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: displayHall.digit.bottom,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  fontSize: displayHall.digit.font,
  fontWeight: cssVars.fontWeights.extrabold,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: displayHall.digit.lineHeight,
  letterSpacing: displayHall.digit.letterSpacing,
  userSelect: 'none',
};

/** Leibchen-Zeichen (oben links) und Pokal (oben rechts): klein in der Ecke, über der Fläche, nie über einer Ziffer. */
export const markStyle = (kind: 'bib' | 'cup', colors: MonitorThemeColors): CSSProperties => ({
  position: 'absolute',
  top: displayHall.mark.inset,
  ...(kind === 'cup' ? { right: displayHall.mark.inset } : { left: displayHall.mark.inset }),
  width: displayHall.mark.size,
  height: displayHall.mark.size,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: cssVars.borderRadius.full,
  borderStyle: 'solid',
  borderWidth: displayHall.mark.border,
  borderColor: colors.background,
  backgroundColor: kind === 'cup' ? colors.progressBar : colors.text,
  color: colors.background,
  fontSize: `calc(${displayHall.mark.size} * ${String(displayHall.mark.iconShare)})`,
});

export const colonStyle: CSSProperties = {
  position: 'absolute',
  top: displayHall.colon.top,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: displayHall.colon.gap,
  pointerEvents: 'none',
};

export const colonDotStyle = (colors: MonitorThemeColors): CSSProperties => ({
  width: displayHall.colon.dot,
  height: displayHall.colon.dot,
  borderRadius: cssVars.borderRadius.full,
  background: colors.textSecondary,
});

export const barRowStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: `calc(${displayHall.bar.gapTop} + ${displayHall.bar.height})`,
  paddingTop: displayHall.bar.gapTop,
  paddingLeft: displayHall.bar.padX,
  paddingRight: displayHall.bar.padX,
};

export const bandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  minHeight: 0,
  paddingLeft: displayHall.band.padX,
  paddingRight: displayHall.band.padX,
  paddingBottom: displayHall.band.padBottom,
};

export const sideColumnStyle = (align: 'start' | 'end'): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: align === 'start' ? 'flex-start' : 'flex-end',
  textAlign: align === 'start' ? 'left' : 'right',
  gap: displayHall.band.sideGap,
  minWidth: 0,
  fontSize: displayHall.side.font,
  fontWeight: cssVars.fontWeights.semibold,
  lineHeight: displayHall.side.lineHeight,
  // Texte neben der Uhr („Feld 1“, „Zeit abgelaufen“) brechen an Leerzeichen um, statt in die Restzeit zu laufen oder über die Spalte hinauszuragen
  whiteSpace: 'normal',
});

export const slotStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  paddingLeft: displayHall.clock.padX,
  paddingRight: displayHall.clock.padX,
  whiteSpace: 'nowrap',
  fontFamily: cssVars.fontFamilies.heading,
  fontWeight: cssVars.fontWeights.extrabold,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: displayLayout.scoreArea.clockLetterSpacing,
  lineHeight: displayHall.clock.lineHeight,
};

/** Abzeichen über dem Zwischenstand des Strafstoßschießens (Zeile über der Zahl) */
export const slotBadgeStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  fontFamily: cssVars.fontFamilies.body,
  fontWeight: cssVars.fontWeights.semibold,
  lineHeight: displayHall.side.lineHeight,
  letterSpacing: 'normal',
  fontVariantNumeric: 'normal',
};

export const slotFontSize = (kind: 'clock' | 'word' | 'shootout'): string => {
  switch (kind) {
    case 'clock': return displayHall.clock.font;
    case 'shootout': return displayHall.shootout.font;
    case 'word': return `min(${displayHall.word.font}, ${displayHall.word.maxWidthShare})`;
  }
};
