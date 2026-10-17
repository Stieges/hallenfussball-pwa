/**
 * Hinweis-Kasten des Monitors (B-48a, @ME-006): Batterie-Symbol in Warnfarbe plus Text, Stil „corner“ (Mockup v8).
 * Zwei Lagen: in der Kopfzeile der Live-Folie (`header`, Grid-Zelle) oder als Ecke oben rechts (`corner`, innerhalb des
 * Bildrands). Schrift nie unter 3 % der Bildhöhe, Maße aus den Display-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';
import { getContrastRatio } from '../../design-tokens/display';

const layout = displayLayout.scoreArea;

/** Mindestkontrast eines Symbols zum Hintergrund (VISUAL-DESIGN Regel 5). */
const SYMBOL_KONTRAST = 3;

export interface LiveHeaderNoticeProps {
  text: string;
  /** Farben des Monitor-Themas (hell/dunkel), wie die Folien sie nutzen */
  themeColors: MonitorThemeColors;
  /** `header`: Zelle in der Kopfzeile (Spalte 2). `corner`: fest oben rechts, Abstand = Bildrand. */
  variant: 'header' | 'corner';
  /** Bildrand des Monitors in px (nur `corner`): der Kasten bleibt innerhalb, mindestens 5 % der Seite. */
  overscanPx?: number;
}

/**
 * Warnfarbe des Themas (`timerWarning`), solange sie 3 : 1 zum Hintergrund hält; sonst die Textfarbe des Themas.
 * Im hellen Thema trägt `timerWarning` nur 2,9 : 1, darum steht dort die Textfarbe (Token-Vorschlag im Report).
 */
function symbolFarbe(t: MonitorThemeColors): string {
  return getContrastRatio(t.timerWarning, t.background) >= SYMBOL_KONTRAST ? t.timerWarning : t.text;
}

function BatterySymbol({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={displayFontSizes.noticeIcon}
      height={displayFontSizes.noticeIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', color }}
    >
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
      <line x1="6" y1="10" x2="6" y2="14" />
    </svg>
  );
}

export function LiveHeaderNotice({ text, themeColors, variant, overscanPx = 0 }: LiveHeaderNoticeProps) {
  const lage: CSSProperties = variant === 'header'
    ? { gridColumn: 2, justifySelf: 'end', alignSelf: 'center', maxWidth: '100%' }
    : {
      position: 'fixed',
      top: `max(${overscanPx}px, ${displayLayout.noticeCornerMin})`,
      right: `max(${overscanPx}px, ${displayLayout.noticeCornerMinX})`,
      maxWidth: displayLayout.noticeCornerMaxWidth,
      zIndex: cssVars.zIndex.sticky,
    };
  const style: CSSProperties = {
    ...lage,
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
  return (
    <div style={style} data-testid="monitor-wakelock-hint" data-variant={variant} role="status">
      <BatterySymbol color={symbolFarbe(themeColors)} />
      <span>{text}</span>
    </div>
  );
}
