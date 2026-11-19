/**
 * Stile der Monitor-Uhr (`MatchTimer`): nur Tokens (C-MONITOR-UHR-LITERALE). Die Monitor-Größe `xl` misst an der Folie
 * (`cqh`/`cqw`), die kleineren Stufen nutzen die App-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout } from '../../design-tokens';
import type { MonitorThemeColors } from '../../design-tokens';

export type MatchTimerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface Stufe {
  time: string; progress: string; gap: string; label: string;
  /** Symbole an der Uhr (@ZM-215): Kantenlänge, Abstand zweier Symbole, Punkte des Abschnitts (Größe, Abstand, Randbreite) */
  symbol: string; symbolGap: string; dot: string; dotGap: string; dotBorder: string;
}

const L = displayLayout.scoreArea;

/** Symbole der kleineren Stufen: Vielfache der Schrift des früheren Worts (dort gibt es keine Folienhöhe als Bezug). */
const kleineSymbole = (label: string): Pick<Stufe, 'symbol' | 'symbolGap' | 'dot' | 'dotGap' | 'dotBorder'> => ({
  symbol: `calc(${label} * 1.6)`, symbolGap: `calc(${label} * 0.4)`, dot: `calc(${label} * 0.9)`, dotGap: `calc(${label} * 0.25)`, dotBorder: `calc(${label} * 0.14)`,
});

export const STUFEN: Record<MatchTimerSize, Stufe> = {
  sm: { time: cssVars.fontSizes.titleLg, progress: cssVars.spacing.xs, gap: cssVars.spacing.xs, label: displayFontSizes.bodySM, ...kleineSymbole(displayFontSizes.bodySM) },
  md: { time: cssVars.fontSizes.headlineMd, progress: cssVars.spacing.sm, gap: cssVars.spacing.sm, label: displayFontSizes.bodySM, ...kleineSymbole(displayFontSizes.bodySM) },
  lg: { time: cssVars.fontSizes.displaySm, progress: cssVars.spacing.sm, gap: cssVars.spacing.md, label: displayFontSizes.bodySM, ...kleineSymbole(displayFontSizes.bodySM) },
  // @ZM-215: Balken 5 % der Höhe, Restzeit 14 % (der Platz der früheren Zeile „Restzeit“ über der Uhr geht an Uhr und Balken)
  xl: {
    time: L.clockFont, progress: L.progressHeight, gap: L.clockGap, label: displayFontSizes.clockHint,
    symbol: L.stateSymbol, symbolGap: L.stateSymbolGap, dot: L.sectionDot, dotGap: L.sectionDotGap, dotBorder: L.sectionDotBorder,
  },
};

export function containerStyle(stufe: Stufe): CSSProperties {
  return { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: stufe.gap, width: '100%' };
}

/**
 * Zeile der Uhr (@ZM-215): die Uhr steht in der Mitte, die Symbole des Zustands (angehalten, Pause, Zeit abgelaufen, Verlängerung, Anstoß) links daneben (man liest
 * „Uhr-Symbol 16:20“, „Pause-Symbol 3:20“) und nur bei Abweichung vom laufenden Spiel, die Punkte des Abschnitts rechts daneben (nur bei mehr als einem Abschnitt);
 * über der Uhr steht nichts. Die Uhr bleibt dabei mittig, ihre Lage ändert sich mit den Symbolen nie (@ZM-151).
 */
export function clockRowStyle(size: MatchTimerSize): CSSProperties {
  return {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%',
    columnGap: size === 'xl' ? L.clockInnerGap : cssVars.spacing.sm,
  };
}

/** Spalte der Symbole des Zustands: erste Spalte, rechts bündig an der Uhr, bricht nie um. */
export function symbolColumnStyle(colors: MonitorThemeColors): CSSProperties {
  return { gridColumn: 1, justifySelf: 'end', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', minWidth: 0, color: colors.text };
}

/** Spalte der Abschnittspunkte: dritte Spalte, links bündig an der Uhr. */
export function sectionColumnStyle(colors: MonitorThemeColors): CSSProperties {
  return { gridColumn: 3, justifySelf: 'start', display: 'flex', alignItems: 'center', minWidth: 0, color: colors.text };
}

export function clockBoxStyle(size: MatchTimerSize): CSSProperties {
  return {
    gridColumn: 2, display: 'flex', alignItems: 'baseline',
    gap: size === 'xl' ? L.clockInnerGap : cssVars.spacing.sm,
    // B-44a2: Größe und Lage der Uhr sind in jeder Phase gleich
    padding: size === 'xl' ? `${L.clockPadY} ${L.clockPadX}` : `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.full,
  };
}

/** @ZM-137: in der angehaltenen Schlussphase eigene Hervorhebungsfarbe (Violett), keine Teamfarbe, kein Rot. */
export function timeStyle(stufe: Stufe, colors: MonitorThemeColors, schlussphase: boolean, gedaempft = false): CSSProperties {
  return {
    fontSize: stufe.time, fontWeight: cssVars.fontWeights.bold, fontFamily: cssVars.fontFamilies.heading,
    // Uhr angehalten: Ziffern gedämpft (@ZM-215), in der Schlussphase bleibt das Violett
    color: schlussphase ? cssVars.colors.scoreboardFinalPhase : gedaempft ? colors.textSecondary : colors.timerNormal,
    textShadow: colors.textShadowLight, letterSpacing: L.clockLetterSpacing, lineHeight: L.clockLineHeight,
  };
}

/** Balken so breit wie die beiden Ergebniskästen zusammen (@ZM-165), Höhe der Stufe. */
export function balkenRahmenStyle(size: MatchTimerSize, stufe: Stufe): CSSProperties {
  return { width: '100%', maxWidth: size === 'xl' ? L.progressWidth : undefined, minHeight: stufe.progress };
}
