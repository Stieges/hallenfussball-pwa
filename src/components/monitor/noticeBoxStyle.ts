/**
 * Rahmen der Hinweis-Ecken des Monitors (Energiespar-Hinweis oben rechts, Verbindungs-Symbol unten rechts): eine Zeile mit fester Höhe,
 * nur Tokens, Schrift nie unter 3 % der Bildhöhe.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';

const layout = displayLayout.scoreArea;

/** Rahmen einer Hinweis-Ecke des Monitors (Energiespar-Hinweis oben rechts, Verbindungs-Symbol unten rechts): eine Zeile, feste Höhe. */
export function noticeBoxStyle(themeColors: MonitorThemeColors): CSSProperties {
  return {
    // Die Ecke des sicheren Bereichs (innerhalb des Bildrands, @ME-067): kein zweiter Rand
    position: 'absolute',
    top: 0,
    right: 0,
    // Eine Zeile mit fester Höhe: die Folie rückt um genau diese Höhe nach unten (@ME-006)
    height: displayLayout.noticeHeight,
    maxWidth: '100%',
    whiteSpace: 'nowrap',
    zIndex: cssVars.zIndex.sticky,
    display: 'flex',
    alignItems: 'center',
    gap: layout.noticeGap,
    boxSizing: 'border-box',
    padding: `${layout.noticePadY} ${layout.noticePadX}`,
    border: `${layout.noticeBorderWidth} solid ${themeColors.border}`,
    borderRadius: layout.noticeRadius,
    background: themeColors.backgroundGradient,
    color: themeColors.text,
    fontSize: displayFontSizes.notice,
    fontWeight: cssVars.fontWeights.semibold,
    lineHeight: layout.noticeLineHeight,
    textAlign: 'left',
  };
}
