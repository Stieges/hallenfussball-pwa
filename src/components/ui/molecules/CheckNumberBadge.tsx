/**
 * Prüfzahl (A-17b, @HE-001, @HE-105): zweistellige Zahl in einem Rahmen. Fachfrei – der Baustein zeigt nur die Ziffern.
 * `big` (Helfer-Handy, Warteschirm): groß in `scoreSizes.sm` mit Info-Ton, lesbar auf zwei Handys im Hallenlicht.
 * `regular`: 18-px-Titelgröße für Zeilen und Zahlknöpfe der Leitung. Farbe allein trägt keine Bedeutung: die Zahl steht
 * immer in Ziffern. `label` ist der gesprochene Text („Prüfzahl 47“); die Ziffern selbst bleiben der sichtbare Inhalt.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export type CheckNumberBadgeSize = 'regular' | 'big';

export interface CheckNumberBadgeProps {
  value: number;
  size?: CheckNumberBadgeSize;
  /** Gesprochener Text, z. B. „Prüfzahl 47“. */
  label?: string;
  'data-testid'?: string;
}

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: cssVars.touchTargets.comfortable,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.xl,
  lineHeight: cssVars.lineHeights.title,
  fontWeight: cssVars.fontWeights.bold,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const big: CSSProperties = {
  ...base,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
  fontSize: cssVars.scoreSizes.sm,
  lineHeight: cssVars.lineHeights.displayMd,
  borderColor: cssVars.colors.info,
  backgroundImage: `linear-gradient(${cssVars.colors.infoLight}, ${cssVars.colors.infoLight})`,
};

export const CheckNumberBadge = ({ value, size = 'regular', label, 'data-testid': testId = 'check-number' }: CheckNumberBadgeProps) => (
  <span data-testid={testId} data-size={size} role={label ? 'img' : undefined} aria-label={label} style={size === 'big' ? big : base}>
    {value}
  </span>
);
