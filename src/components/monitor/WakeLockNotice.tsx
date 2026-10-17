/**
 * Hinweis-Ecke des Monitors (B-48a, @ME-006): Batterie-Symbol in Warnfarbe plus Text, oben rechts innerhalb des
 * Bildrands. Steht nur auf Folien ohne laufendes Spiel, 10 Sekunden lang (Regeln in useWakeLockHinweis).
 * Schrift nie unter 3 % der Bildhöhe, Maße aus den Display-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars, displayFontSizes, displayLayout, type MonitorThemeColors } from '../../design-tokens';

const layout = displayLayout.scoreArea;

export interface WakeLockNoticeProps {
  text: string;
  /** Farben des Monitor-Themas (hell/dunkel), wie die Folien sie nutzen */
  themeColors: MonitorThemeColors;
  /** Bildrand des Monitors in px: der Kasten bleibt innerhalb, mindestens 5 % der Seite. */
  overscanPx?: number;
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

export function WakeLockNotice({ text, themeColors, overscanPx = 0 }: WakeLockNoticeProps) {
  const style: CSSProperties = {
    position: 'fixed',
    top: `max(${overscanPx}px, ${displayLayout.noticeCornerMin})`,
    right: `max(${overscanPx}px, ${displayLayout.noticeCornerMinX})`,
    maxWidth: displayLayout.noticeCornerMaxWidth,
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
  return (
    <div style={style} data-testid="monitor-wakelock-hint" role="status">
      <BatterySymbol color={themeColors.warningSymbol} />
      <span>{text}</span>
    </div>
  );
}
