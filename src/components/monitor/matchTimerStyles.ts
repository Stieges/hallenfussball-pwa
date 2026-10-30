/**
 * Stile der Monitor-Uhr (`MatchTimer`): nur Tokens (C-MONITOR-UHR-LITERALE). Die Monitor-Größe `xl` misst an der Folie
 * (`cqh`/`cqw`), die kleineren Stufen nutzen die App-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import type { MonitorThemeColors } from '../../design-tokens';

export type MatchTimerSize = 'sm' | 'md' | 'lg' | 'xl';

interface Stufe { time: string; progress: string; gap: string; label: string }

const L = displayLayout.scoreArea;

export const STUFEN: Record<MatchTimerSize, Stufe> = {
  sm: { time: cssVars.fontSizes.titleLg, progress: cssVars.spacing.xs, gap: cssVars.spacing.xs, label: displayFontSizes.bodySM },
  md: { time: cssVars.fontSizes.headlineMd, progress: cssVars.spacing.sm, gap: cssVars.spacing.sm, label: displayFontSizes.bodySM },
  lg: { time: cssVars.fontSizes.displaySm, progress: cssVars.spacing.sm, gap: cssVars.spacing.md, label: displayFontSizes.bodySM },
  // F5 (Plan R5, „gilt nach Vorschlag“): Balken ≈ 3 % der Bildhöhe (@ZM-165)
  xl: { time: displayFontSizes.clockXL, progress: L.progressHeight, gap: L.clockGap, label: displayFontSizes.clockHint },
};

export function containerStyle(stufe: Stufe): CSSProperties {
  return { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: stufe.gap, width: '100%' };
}

/** Zeile über der Uhr: immer da, feste Höhe auch ohne Text (B-44a2: die Lage ändert sich nie), bricht nie um. */
export function labelRowStyle(size: MatchTimerSize, stufe: Stufe): CSSProperties {
  return {
    display: 'flex', justifyContent: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap',
    minHeight: size === 'xl' ? `calc(${stufe.label} * ${L.hintLineHeight})` : undefined,
    lineHeight: L.hintLineHeight,
  };
}

/** H1: der Text steht direkt auf dem Monitor-Hintergrund, in der Textfarbe (Kontrast ≥ 4,5 : 1). */
export function labelStyle(stufe: Stufe, colors: MonitorThemeColors): CSSProperties {
  return { fontSize: stufe.label, fontWeight: cssVars.fontWeights.bold, color: colors.text, textAlign: 'center' };
}

export function clockBoxStyle(size: MatchTimerSize): CSSProperties {
  return {
    display: 'flex', alignItems: 'baseline',
    gap: size === 'xl' ? L.clockInnerGap : cssVars.spacing.sm,
    // B-44a2: Größe und Lage der Uhr sind in jeder Phase gleich
    padding: size === 'xl' ? `${L.clockPadY} ${L.clockPadX}` : `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.full,
  };
}

/** @ZM-137: in der angehaltenen Schlussphase eigene Hervorhebungsfarbe (Violett), keine Teamfarbe, kein Rot. */
export function timeStyle(stufe: Stufe, colors: MonitorThemeColors, schlussphase: boolean): CSSProperties {
  return {
    fontSize: stufe.time, fontWeight: cssVars.fontWeights.bold, fontFamily: cssVars.fontFamilies.heading,
    color: schlussphase ? cssVars.colors.scoreboardFinalPhase : colors.timerNormal,
    textShadow: colors.textShadowLight, letterSpacing: L.clockLetterSpacing, lineHeight: L.clockLineHeight,
  };
}

/** Balken so breit wie die beiden Ergebniskästen zusammen (@ZM-165), Höhe der Stufe. */
export function balkenRahmenStyle(size: MatchTimerSize, stufe: Stufe): CSSProperties {
  return { width: '100%', maxWidth: size === 'xl' ? L.progressWidth : undefined, minHeight: stufe.progress };
}
