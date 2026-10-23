/**
 * Marke an einer Tabellenzeile (Paket TB-B, TB-6b; Mockup v3, G5): Symbol und Wort, Farbe nie allein
 * (VISUAL-DESIGN § 7). `warn` = der Gleichstand wartet auf die Turnierleitung, `done` = entschieden. Fachfrei: Text und
 * Symbol bestimmt der Aufrufer, der Baustein kennt weder Tabelle noch Turnier. Kein Rand-Literal: Bedien-Rand
 * (`borderControl`, ≥ 3 : 1), Warn-Rand `warningSolid`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export type TieMarkerTone = 'warn' | 'done';
export type TieMarkerSymbol = 'warn' | 'equal' | 'check';

export interface TieMarkerProps {
  tone: TieMarkerTone;
  symbol: TieMarkerSymbol;
  children: ReactNode;
  'data-testid'?: string;
  /** Art der Marke für Tests und Messung (`need`, `open`, `same` …). */
  'data-kind'?: string;
}

const EqualSymbol = () => (
  <svg width={iconSizeValues.xs} height={iconSizeValues.xs} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 9h14M5 15h14" />
  </svg>
);

const SYMBOLS: Record<TieMarkerSymbol, ReactNode> = {
  warn: <Icons.AlertTriangle size={iconSizeValues.xs} />,
  equal: <EqualSymbol />,
  check: <Icons.Check size={iconSizeValues.xs} />,
};

export const TieMarker = ({ tone, symbol, children, 'data-testid': testId = 'tie-marker', 'data-kind': kind }: TieMarkerProps) => {
  const warn = tone === 'warn';
  const mark: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.xs,
    maxWidth: '100%',
    marginTop: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    border: `${cssVars.borderWidth.thin} solid ${warn ? cssVars.colors.warningSolid : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'left',
    backgroundColor: cssVars.colors.background,
    backgroundImage: warn ? `linear-gradient(${cssVars.colors.warningLight}, ${cssVars.colors.warningLight})` : undefined,
    color: cssVars.colors.textPrimary, // Text bleibt textPrimary (Kontrast), Farbe trägt nur Rand und Symbol
    fontSize: cssVars.fontSizes.sm,
    lineHeight: cssVars.lineHeights.bodySm,
    fontWeight: cssVars.fontWeights.semibold,
    overflowWrap: 'anywhere',
  };
  const symbolStyle: CSSProperties = { display: 'flex', flex: 'none', color: warn ? cssVars.colors.warningSolid : cssVars.colors.primary };
  return (
    <span style={mark} data-testid={testId} data-kind={kind} data-tone={tone}>
      <span style={symbolStyle} aria-hidden="true">{SYMBOLS[symbol]}</span>
      <span>{children}</span>
    </span>
  );
};
