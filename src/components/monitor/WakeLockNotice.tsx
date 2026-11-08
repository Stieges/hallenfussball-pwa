/**
 * Hinweis-Ecke des Monitors (B-48a, @ME-006): Batterie-Symbol in Warnfarbe plus Text, oben rechts innerhalb des
 * Bildrands (Ecke des sicheren Bereichs). Steht nur auf Einrichtungs- und QR-Folien ohne laufendes Spiel, 10 Sekunden lang (Regeln in useWakeLockHinweis).
 * Schrift nie unter 3 % der Bildhöhe, Maße aus den Display-Tokens.
 */
import { displayFontSizes, type MonitorThemeColors } from '../../design-tokens';
import { noticeBoxStyle } from './noticeBoxStyle';

export interface WakeLockNoticeProps {
  text: string;
  /** Farben des Monitor-Themas (hell/dunkel), wie die Folien sie nutzen */
  themeColors: MonitorThemeColors;
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

export function WakeLockNotice({ text, themeColors }: WakeLockNoticeProps) {
  return (
    <div style={noticeBoxStyle(themeColors)} data-testid="monitor-wakelock-hint" role="status">
      <BatterySymbol color={themeColors.warningSymbol} />
      <span>{text}</span>
    </div>
  );
}
