/**
 * Zustandsmarke (GA4 A-13c, Mockup A-13c): Symbol und Wort, Farbe nie allein (VISUAL-DESIGN § 7). Gleiche Form wie die Marke an
 * der Tabellenzeile (`TieMarker`), aber mit Ton `neutral` (offen, läuft), `info` (bereit zum Abschluss), `done` (abgeschlossen)
 * und `warn` (Zusatzmarken „Besetzung prüfen“, „noch nicht gesendet“). Fachfrei: Text und Symbol bestimmt der Aufrufer.
 * Kein Rand-Literal: Bedien-Rand `borderControl`, Ton-Ränder aus den Farbtokens.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export type StateMarkTone = 'neutral' | 'info' | 'done' | 'warn';
export type StateMarkSymbol = 'circle' | 'play' | 'flag' | 'check' | 'warn' | 'offline';

export interface StateMarkProps {
  tone: StateMarkTone;
  symbol: StateMarkSymbol;
  children: ReactNode;
  'data-testid'?: string;
  /** Wiederholte Marken in einer Zeile: kein Abstand nach oben. */
  'data-kind'?: string;
}

const size = iconSizeValues.xs;
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const SYMBOLS: Record<StateMarkSymbol, ReactNode> = {
  circle: <Svg><circle cx="12" cy="12" r="9" /></Svg>,
  play: <Svg><path d="M8 5l11 7-11 7z" /></Svg>,
  flag: <Svg><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></Svg>,
  check: <Icons.Check size={size} />,
  warn: <Icons.AlertTriangle size={size} />,
  offline: <Icons.WifiOff size={size} />,
};

const TONES: Record<StateMarkTone, { border: string; symbol: string; tint?: string }> = {
  neutral: { border: cssVars.colors.borderControl, symbol: cssVars.colors.textSecondary },
  info: { border: cssVars.colors.info, symbol: cssVars.colors.info, tint: cssVars.colors.infoLight },
  done: { border: cssVars.colors.borderControl, symbol: cssVars.colors.primary },
  warn: { border: cssVars.colors.warningSolid, symbol: cssVars.colors.warningSolid, tint: cssVars.colors.warningLight },
};

export const StateMark = ({ tone, symbol, children, 'data-testid': testId, 'data-kind': kind }: StateMarkProps) => {
  const look = TONES[tone];
  const mark: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    maxWidth: '100%',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    border: `${cssVars.borderWidth.thin} solid ${look.border}`,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'left',
    backgroundColor: cssVars.colors.background,
    backgroundImage: look.tint === undefined ? undefined : `linear-gradient(${look.tint}, ${look.tint})`,
    color: cssVars.colors.textPrimary, // Text bleibt textPrimary (Kontrast), Farbe trägt nur Rand und Symbol
    fontSize: cssVars.fontSizes.sm,
    lineHeight: cssVars.lineHeights.bodySm,
    fontWeight: cssVars.fontWeights.semibold,
    overflowWrap: 'anywhere',
  };
  return (
    <span style={mark} data-testid={testId} data-kind={kind} data-tone={tone}>
      <span style={{ display: 'flex', flex: 'none', color: look.symbol, marginTop: `calc(${cssVars.spacing.xs} / 2)` }} aria-hidden="true">{SYMBOLS[symbol]}</span>
      <span>{children}</span>
    </span>
  );
};
